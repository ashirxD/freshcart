import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model, PipelineStage, Types } from 'mongoose';
import { PaginatedResult, paginated } from 'src/common/dto';
import { StockStatus, deriveStockStatus } from 'src/common/enums';
import { escapeRegExp } from 'src/common/utils';
import { PRODUCT_COLLECTION } from 'src/modules/products/schemas';
import { StoresService } from 'src/modules/stores';
import { AuthenticatedUser } from 'src/common/interfaces';
import { SettingsService } from 'src/modules/settings';
import { QueryInventoryDto, UpdateInventoryDto } from './dto';
import {
  Inventory,
  InventoryAdjustment,
  InventoryAdjustmentDocument,
  InventoryDocument,
  StockChangeReason,
} from './schemas';

/** Stock as the rest of the application consumes it: quantity plus derived state. */
export interface StockView {
  quantity: number;
  lowStockThreshold: number;
  status: StockStatus;
  isAvailable: boolean;
}

/** A stock row joined with just enough product identity to be actionable. */
export interface InventoryRow extends StockView {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  imageUrl?: string;
  isProductActive: boolean;
  updatedAt: Date;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectModel(Inventory.name) private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(InventoryAdjustment.name)
    private readonly adjustmentModel: Model<InventoryAdjustmentDocument>,
    private readonly storesService: StoresService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Which store a read or write applies to.
   *
   * An explicit scope always wins. It is supplied by store-operations callers,
   * which resolve it from the authenticated principal (see `store-scope.ts`) —
   * never from a request. Omitting it falls back to the configured active store,
   * which is what the admin surfaces and the single-store catalogue do.
   */
  private async resolveStoreId(storeId?: Types.ObjectId): Promise<Types.ObjectId> {
    return storeId ?? (await this.storesService.getActiveStoreObjectId());
  }

  /** Turns a raw stock row into the shape every caller reads. */
  static toStockView(source: { quantity: number; lowStockThreshold: number } | null): StockView {
    const quantity = source?.quantity ?? 0;
    const lowStockThreshold = source?.lowStockThreshold ?? 0;
    const status = deriveStockStatus(quantity, lowStockThreshold);

    return {
      quantity,
      lowStockThreshold,
      status,
      isAvailable: status !== StockStatus.OUT_OF_STOCK,
    };
  }

  /**
   * Creates the stock row for a new product, or returns the existing one.
   * Upsert rather than create-then-check, so two concurrent product imports
   * cannot produce a duplicate (the unique index would reject the second).
   *
   * An unspecified threshold falls back to the platform default rather than to
   * a constant, so an admin who decides five is too low for this catalogue does
   * not have to edit code — and existing rows keep the threshold they already
   * have, because a default is not a retroactive rewrite.
   */
  async ensureFor(
    productId: Types.ObjectId,
    storeId: Types.ObjectId,
    initial: { quantity?: number; lowStockThreshold?: number } = {},
  ): Promise<InventoryDocument> {
    const document = await this.inventoryModel
      .findOneAndUpdate(
        { productId, storeId },
        {
          $setOnInsert: {
            productId,
            storeId,
            quantity: initial.quantity ?? 0,
            lowStockThreshold:
              initial.lowStockThreshold ?? (await this.settingsService.defaultLowStockThreshold()),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    return document;
  }

  /** Stock for one product at the active store. */
  async getFor(productId: Types.ObjectId, storeId: Types.ObjectId): Promise<StockView> {
    const document = await this.inventoryModel
      .findOne({ productId, storeId })
      .select('quantity lowStockThreshold')
      .lean()
      .exec();

    return InventoryService.toStockView(document);
  }

  /** Stock for many products in one query — the cart and favourites path. */
  async getManyFor(
    productIds: Types.ObjectId[],
    storeId: Types.ObjectId,
  ): Promise<Map<string, StockView>> {
    if (productIds.length === 0) return new Map();

    const rows = await this.inventoryModel
      .find({ productId: { $in: productIds }, storeId })
      .select('productId quantity lowStockThreshold')
      .lean()
      .exec();

    return new Map(
      rows.map((row) => [row.productId.toString(), InventoryService.toStockView(row)]),
    );
  }

  /**
   * Back-office stock list. Joins the product collection by name rather than
   * through ProductsService, which would make inventory depend on the module
   * that depends on it.
   */
  async list(
    query: QueryInventoryDto,
    scopedStoreId?: Types.ObjectId,
  ): Promise<PaginatedResult<InventoryRow>> {
    const storeId = await this.resolveStoreId(scopedStoreId);

    const pipeline: PipelineStage[] = [
      { $match: { storeId } },
      {
        $lookup: {
          from: PRODUCT_COLLECTION,
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
          pipeline: [{ $project: { name: 1, sku: 1, images: 1, isActive: 1 } }],
        },
      },
      { $unwind: '$product' },
    ];

    if (query.search) {
      const pattern = new RegExp(escapeRegExp(query.search), 'i');
      pipeline.push({ $match: { $or: [{ 'product.name': pattern }, { 'product.sku': pattern }] } });
    }

    // Mirrors `deriveStockStatus` exactly, in aggregation form. The two must
    // agree or a filtered list would disagree with the badge on its own rows:
    //   quantity <= 0                     -> OUT_OF_STOCK
    //   quantity <= lowStockThreshold      -> LOW_STOCK
    //   otherwise                          -> IN_STOCK
    if (query.status === StockStatus.OUT_OF_STOCK) {
      pipeline.push({ $match: { quantity: { $lte: 0 } } });
    } else if (query.status === StockStatus.LOW_STOCK) {
      pipeline.push({
        $match: {
          quantity: { $gt: 0 },
          $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
        },
      });
    } else if (query.status === StockStatus.IN_STOCK) {
      pipeline.push({
        $match: {
          quantity: { $gt: 0 },
          $expr: { $gt: ['$quantity', '$lowStockThreshold'] },
        },
      });
    } else if (query.outOfStockOnly) {
      pipeline.push({ $match: { quantity: { $lte: 0 } } });
    } else if (query.lowStockOnly) {
      pipeline.push({ $match: { $expr: { $lte: ['$quantity', '$lowStockThreshold'] } } });
    }

    pipeline.push({
      $facet: {
        items: [
          { $sort: { quantity: 1, 'product.name': 1 } },
          { $skip: query.skip },
          { $limit: query.limit },
        ],
        total: [{ $count: 'value' }],
      },
    });

    type Row = {
      _id: Types.ObjectId;
      productId: Types.ObjectId;
      quantity: number;
      lowStockThreshold: number;
      updatedAt: Date;
      product: {
        name: string;
        sku: string;
        isActive: boolean;
        images?: Array<{ url: string; sortOrder: number }>;
      };
    };

    const [result] = await this.inventoryModel
      .aggregate<{ items: Row[]; total: Array<{ value: number }> }>(pipeline)
      .exec();

    const items: InventoryRow[] = (result?.items ?? []).map((row) => ({
      id: row._id.toString(),
      productId: row.productId.toString(),
      productName: row.product.name,
      sku: row.product.sku,
      imageUrl: [...(row.product.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url,
      isProductActive: row.product.isActive,
      updatedAt: row.updatedAt,
      ...InventoryService.toStockView(row),
    }));

    return paginated(items, result?.total[0]?.value ?? 0, {
      page: query.page,
      limit: query.limit,
    });
  }

  async findForProduct(
    productId: string,
    scopedStoreId?: Types.ObjectId,
  ): Promise<StockView & { productId: string }> {
    const storeId = await this.resolveStoreId(scopedStoreId);
    const document = await this.inventoryModel
      .findOne({ productId: new Types.ObjectId(productId), storeId })
      .lean()
      .exec();

    if (!document) throw new NotFoundException('No stock record exists for this product');

    return { productId, ...InventoryService.toStockView(document) };
  }

  /**
   * Absolute set or relative adjustment.
   *
   * The relative form uses a single conditional `$inc`-style update guarded by a
   * filter, so two simultaneous adjustments cannot both read 10 and both write
   * 12. The absolute form is last-write-wins by definition — that is what "set
   * the count to 40" means after a stock take.
   */
  async update(
    productId: string,
    dto: UpdateInventoryDto,
    options: { storeId?: Types.ObjectId; actor?: AuthenticatedUser } = {},
  ): Promise<StockView & { productId: string }> {
    if (dto.quantity !== undefined && dto.adjustBy !== undefined) {
      throw new BadRequestException(
        'Send either quantity (absolute) or adjustBy (relative), not both',
      );
    }

    if (
      dto.quantity === undefined &&
      dto.adjustBy === undefined &&
      dto.lowStockThreshold === undefined
    ) {
      throw new BadRequestException('Nothing to update');
    }

    const storeId = await this.resolveStoreId(options.storeId);
    const filter: FilterQuery<InventoryDocument> = {
      productId: new Types.ObjectId(productId),
      storeId,
    };

    // Read for the audit trail only. The write below never trusts it: the
    // adjustment path keeps its guard in the query filter, and the absolute path
    // is last-write-wins by definition. A stale reading here can therefore make
    // the recorded `previousQuantity` slightly historical under concurrency, but
    // it can never make the stock level itself wrong.
    const before = await this.inventoryModel.findOne(filter).select('quantity').lean().exec();

    let updated: InventoryDocument | null;

    if (dto.adjustBy !== undefined) {
      // Guard in the filter, not in application code: a decrement may only apply
      // if there is still enough stock at the moment of the write.
      const guarded: FilterQuery<InventoryDocument> =
        dto.adjustBy < 0 ? { ...filter, quantity: { $gte: -dto.adjustBy } } : filter;

      updated = await this.inventoryModel
        .findOneAndUpdate(
          guarded,
          {
            $inc: { quantity: dto.adjustBy },
            ...(dto.lowStockThreshold !== undefined
              ? { $set: { lowStockThreshold: dto.lowStockThreshold } }
              : {}),
          },
          { new: true },
        )
        .exec();

      if (!updated) {
        const exists = await this.inventoryModel.exists(filter);
        throw exists
          ? new BadRequestException('Not enough stock on hand to apply that adjustment')
          : new NotFoundException('No stock record exists for this product');
      }
    } else {
      const set: Record<string, number> = {};
      if (dto.quantity !== undefined) set.quantity = dto.quantity;
      if (dto.lowStockThreshold !== undefined) set.lowStockThreshold = dto.lowStockThreshold;

      updated = await this.inventoryModel
        .findOneAndUpdate(filter, { $set: set }, { new: true })
        .exec();

      if (!updated) throw new NotFoundException('No stock record exists for this product');
    }

    // Operational event only — never the request body, never customer data.
    this.logger.log(
      'Stock updated for product ' +
        productId +
        ' -> ' +
        updated.quantity +
        (dto.reason ? ' (' + dto.reason + ')' : ''),
    );

    // Recorded only when the quantity actually moved and a real actor did it.
    // A threshold-only edit is not a stock movement, and an unattributed row
    // would be worse than no row.
    if (options.actor && before && before.quantity !== updated.quantity) {
      await this.recordAdjustment({
        productId: new Types.ObjectId(productId),
        storeId,
        previousQuantity: before.quantity,
        newQuantity: updated.quantity,
        reason: dto.changeReason ?? StockChangeReason.CORRECTION,
        note: dto.reason?.trim() || null,
        actor: options.actor,
      });
    }

    return { productId, ...InventoryService.toStockView(updated) };
  }

  /**
   * Writes the audit row.
   *
   * Failure is logged, never raised. The stock change has already been committed
   * and is correct; losing its audit row is a bookkeeping loss, and turning that
   * into a 500 would tell the manager their update failed when it did not — and
   * they would very likely apply it a second time.
   */
  private async recordAdjustment(entry: {
    productId: Types.ObjectId;
    storeId: Types.ObjectId;
    previousQuantity: number;
    newQuantity: number;
    reason: StockChangeReason;
    note: string | null;
    actor: AuthenticatedUser;
  }): Promise<void> {
    try {
      await this.adjustmentModel.create({
        productId: entry.productId,
        storeId: entry.storeId,
        previousQuantity: entry.previousQuantity,
        newQuantity: entry.newQuantity,
        delta: entry.newQuantity - entry.previousQuantity,
        reason: entry.reason,
        note: entry.note,
        changedByUserId: new Types.ObjectId(entry.actor.userId),
        changedByRole: entry.actor.role,
      });
    } catch (error) {
      this.logger.error(
        'Stock changed but the audit row could not be written for product ' +
          entry.productId.toString(),
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** The recent stock movements for one product, newest first. */
  async recentAdjustments(
    productId: string,
    storeId: Types.ObjectId,
    limit = 10,
  ): Promise<
    Array<{
      previousQuantity: number;
      newQuantity: number;
      delta: number;
      reason: StockChangeReason;
      note: string | null;
      changedByRole: string;
      changedAt: Date;
    }>
  > {
    const rows = await this.adjustmentModel
      .find({ productId: new Types.ObjectId(productId), storeId })
      .sort({ changedAt: -1 })
      .limit(Math.min(limit, 50))
      .select('previousQuantity newQuantity delta reason note changedByRole changedAt')
      .lean()
      .exec();

    return rows.map((row) => ({
      previousQuantity: row.previousQuantity,
      newQuantity: row.newQuantity,
      delta: row.delta,
      reason: row.reason,
      note: row.note,
      changedByRole: row.changedByRole,
      changedAt: row.changedAt,
    }));
  }

  /**
   * How many products sit in each availability band, for the operations
   * dashboard.
   *
   * One aggregation over the store's stock rows, bucketed server-side. Counting
   * this by paging the inventory list — or worse, by three separate count
   * queries — is the kind of dashboard cost that grows with the catalogue for no
   * reason. The bucket boundaries restate `deriveStockStatus` in aggregation
   * form; the spec's §35 alert counts and the badge on each row must agree.
   */
  async countByStatus(storeId: Types.ObjectId): Promise<Record<StockStatus, number>> {
    const rows = await this.inventoryModel
      .aggregate<{ _id: StockStatus; count: number }>([
        { $match: { storeId } },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lte: ['$quantity', 0] }, then: StockStatus.OUT_OF_STOCK },
                  {
                    case: { $lte: ['$quantity', '$lowStockThreshold'] },
                    then: StockStatus.LOW_STOCK,
                  },
                ],
                default: StockStatus.IN_STOCK,
              },
            },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    const counts: Record<StockStatus, number> = {
      [StockStatus.IN_STOCK]: 0,
      [StockStatus.LOW_STOCK]: 0,
      [StockStatus.OUT_OF_STOCK]: 0,
    };

    for (const row of rows) counts[row._id] = row.count;

    return counts;
  }

  // --- Order fulfilment ---------------------------------------------------

  /**
   * INVENTORY CONCURRENCY
   * =====================
   *
   * Two shoppers reach for the last packet at the same moment. The naive
   * sequence — read 1, see 1 >= 1, write 0 — lets both succeed, because both
   * read before either wrote. That is not a rare race: it is the *expected*
   * outcome under any real load, and it oversells.
   *
   * The fix is to never read. The stock check lives inside the update filter,
   * so MongoDB evaluates the condition and applies the decrement as one atomic
   * document operation:
   *
   *     { productId, storeId, quantity: { $gte: n } }  ->  { $inc: { quantity: -n } }
   *
   * Exactly one of the two concurrent writers matches that filter. The other
   * matches nothing, gets `null` back, and is told the truth — there is not
   * enough stock. No lock, no retry, no version field, and correct across
   * however many API instances are running.
   *
   * Returns false rather than throwing, because the caller is decrementing a
   * basket: it needs to know *which* line failed so it can name the product and
   * undo the lines it already took.
   */
  async tryReserve(
    productId: Types.ObjectId,
    storeId: Types.ObjectId,
    quantity: number,
    session: ClientSession | null = null,
  ): Promise<boolean> {
    const result = await this.inventoryModel
      .findOneAndUpdate(
        // The guard IS the concurrency control. Never hoist it into an `if`.
        { productId, storeId, quantity: { $gte: quantity } },
        { $inc: { quantity: -quantity } },
        { new: true, session: session ?? undefined },
      )
      .exec();

    return result !== null;
  }

  /**
   * Puts stock back — for a cancelled order, or to undo a partially applied
   * reservation when a later line in the same basket could not be taken.
   *
   * Unconditional: there is no filter that could fail, because returning stock
   * must always succeed. A failure here would leave units that exist on the
   * shelf but not in the system.
   */
  async release(
    productId: Types.ObjectId,
    storeId: Types.ObjectId,
    quantity: number,
    session: ClientSession | null = null,
  ): Promise<void> {
    await this.inventoryModel
      .updateOne({ productId, storeId }, { $inc: { quantity } }, { session: session ?? undefined })
      .exec();
  }

  /** Removes the stock row for a product that is being deleted. */
  async removeForProduct(productId: Types.ObjectId, storeId: Types.ObjectId): Promise<void> {
    await this.inventoryModel.deleteOne({ productId, storeId }).exec();
  }
}

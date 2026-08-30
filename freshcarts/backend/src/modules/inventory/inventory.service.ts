import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PipelineStage, Types } from 'mongoose';
import { PaginatedResult, paginated } from 'src/common/dto';
import { StockStatus, deriveStockStatus } from 'src/common/enums';
import { escapeRegExp } from 'src/common/utils';
import { PRODUCT_COLLECTION } from 'src/modules/products/schemas';
import { StoresService } from 'src/modules/stores';
import { QueryInventoryDto, UpdateInventoryDto } from './dto';
import { Inventory, InventoryDocument } from './schemas';

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
    private readonly storesService: StoresService,
  ) {}

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
            lowStockThreshold: initial.lowStockThreshold ?? 5,
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
  async list(query: QueryInventoryDto): Promise<PaginatedResult<InventoryRow>> {
    const storeId = await this.storesService.getActiveStoreObjectId();

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

    if (query.outOfStockOnly) {
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

  async findForProduct(productId: string): Promise<StockView & { productId: string }> {
    const storeId = await this.storesService.getActiveStoreObjectId();
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

    const storeId = await this.storesService.getActiveStoreObjectId();
    const filter: FilterQuery<InventoryDocument> = {
      productId: new Types.ObjectId(productId),
      storeId,
    };

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

    return { productId, ...InventoryService.toStockView(updated) };
  }

  /** Removes the stock row for a product that is being deleted. */
  async removeForProduct(productId: Types.ObjectId, storeId: Types.ObjectId): Promise<void> {
    await this.inventoryModel.deleteOne({ productId, storeId }).exec();
  }
}

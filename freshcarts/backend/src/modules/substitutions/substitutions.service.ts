import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TransactionRunner } from 'src/common/database';
import { Role } from 'src/common/enums';
import { BusinessException } from 'src/common/errors';
import { InventoryService } from 'src/modules/inventory';
import { OrderStatus, OrdersService } from 'src/modules/orders';
import { ProductsService, formatUnitLabel } from 'src/modules/products';
import { DecideSubstitutionDto, ProposeSubstitutionDto, SubstitutionDecision } from './dto';
import { LeanSubstitution, SubstitutionView, toSubstitutionView } from './substitution.view';
import { Substitution, SubstitutionDocument, SubstitutionStatus } from './schemas';

/**
 * The window in which an order's lines may still be changed.
 *
 * Opens at CONFIRMED, because before the store has accepted an order there is
 * nothing to renegotiate — the right move is to confirm it or reject it. Closes
 * after PREPARING, because a PACKED order is a sealed bag: swapping a line at
 * that point would describe something different from what is physically there.
 */
const EDITABLE_STATUSES: readonly OrderStatus[] = [OrderStatus.CONFIRMED, OrderStatus.PREPARING];

@Injectable()
export class SubstitutionsService {
  private readonly logger = new Logger(SubstitutionsService.name);

  constructor(
    @InjectModel(Substitution.name)
    private readonly substitutionModel: Model<SubstitutionDocument>,
    private readonly ordersService: OrdersService,
    private readonly productsService: ProductsService,
    private readonly inventoryService: InventoryService,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  /**
   * THE PRICE RULE
   * ==============
   *
   * A substitution never increases what the shopper pays. Ever.
   *
   * They agreed a total at checkout. A replacement is the store solving its own
   * supply problem, so the store carries the cost of solving it: the accepted
   * line keeps charging exactly the original line total, and any difference is
   * absorbed. A dearer replacement is refused outright rather than offered as an
   * upcharge, because "accept this and pay Rs. 40 more" is a re-quote, and
   * re-quoting an order is checkout's job, not a picker's (§29).
   *
   * The consequence worth stating plainly: `order.pricing` is never touched by
   * this module. The subtotal, delivery fee and total of an order with an
   * accepted substitution are byte-for-byte what they were when it was placed —
   * which is why the order schema's `subtotal + fee - discount === total`
   * invariant cannot be disturbed from here.
   *
   * A cheaper replacement is also charged at the original price. That is a
   * deliberate simplification and a genuine limitation: crediting the difference
   * means a partial refund, and there is no refund path until payments grow one.
   * It is recorded on the proposal so the shopper sees both numbers before
   * agreeing, and it is flagged in the milestone report.
   */
  async propose(
    scope: { storeId: Types.ObjectId; actorId: string; actorRole: Role },
    orderId: string,
    originalProductId: string,
    dto: ProposeSubstitutionDto,
  ): Promise<SubstitutionView> {
    // One store-scoped read that yields both ownership and the line facts.
    const order = await this.ordersService.loadStoreOrderForEdit(scope.storeId, orderId);

    if (!EDITABLE_STATUSES.includes(order.status)) {
      throw BusinessException.substitutionOrderNotEditable(order.statusLabel);
    }

    const line = order.items.find((item) => item.productId.toString() === originalProductId);
    if (!line) {
      throw BusinessException.substitutionInvalid('That product is not on this order.');
    }

    if (line.productId.toString() === dto.replacementProductId) {
      throw BusinessException.substitutionInvalid(
        'The replacement is the same product as the original.',
      );
    }

    // Two lines for one product would break the "a product appears once per
    // order" assumption the whole line-identification scheme rests on.
    if (order.items.some((item) => item.productId.toString() === dto.replacementProductId)) {
      throw BusinessException.substitutionInvalid(
        'That product is already on this order. Change its quantity instead of substituting into it.',
      );
    }

    // Authoritative catalogue read, scoped to this store: the price and the
    // availability both come from the database, never from the request.
    const { product: replacement, stock } = await this.productsService.findPurchasableOrFail(
      dto.replacementProductId,
      scope.storeId,
    );

    const replacementQuantity = dto.replacementQuantity ?? line.quantity;
    const chargedLineTotal = line.lineTotal;
    const catalogueLineTotal = replacement.sellingPrice * replacementQuantity;

    if (catalogueLineTotal > chargedLineTotal) {
      throw BusinessException.substitutionPriceIncrease({
        originalProductName: line.productName,
        replacementProductName: replacement.name,
        chargedLineTotal,
        catalogueLineTotal,
        difference: catalogueLineTotal - chargedLineTotal,
      });
    }

    /**
     * The charged line total must divide evenly by the new quantity.
     *
     * The order line stores `unitPrice`, `quantity` and `lineTotal`, and
     * `unitPrice × quantity === lineTotal` has to stay exact — a receipt whose
     * own arithmetic does not add up is worse than a refused substitution. With
     * integer rupees that means the division must be clean, so a swap of 1 × 340
     * into 2 units is fine (170 each) and into 3 is not.
     */
    if (chargedLineTotal % replacementQuantity !== 0) {
      throw BusinessException.substitutionInvalid(
        'Rs. ' +
          chargedLineTotal +
          ' does not divide evenly into ' +
          replacementQuantity +
          ' units. Choose a quantity that does, such as ' +
          this.suggestQuantities(chargedLineTotal).join(' or ') +
          '.',
      );
    }

    if (stock.quantity < replacementQuantity) {
      throw BusinessException.substitutionReplacementUnavailable(
        'There is not enough ' + replacement.name + ' in stock to offer as a replacement.',
      );
    }

    return this.transactionRunner.run(async (context) => {
      /**
       * The replacement is set aside at proposal time, not at acceptance.
       *
       * A proposal is a promise: "we have this, will you take it?". Reserving on
       * acceptance would let the store promise stock that another order takes
       * while the shopper is deciding, and the acceptance would then fail for
       * reasons the shopper cannot act on. The guarded decrement is the same
       * atomic operation checkout uses, so it cannot oversell.
       */
      const reserved = await this.inventoryService.tryReserve(
        replacement._id,
        scope.storeId,
        replacementQuantity,
        context.session,
      );

      if (!reserved) {
        throw BusinessException.substitutionReplacementUnavailable(
          replacement.name + ' has just run out. Choose another replacement.',
        );
      }

      context.compensate('return replacement stock for ' + replacement.sku, () =>
        this.inventoryService.release(replacement._id, scope.storeId, replacementQuantity),
      );

      let created: SubstitutionDocument;

      try {
        const [document] = await this.substitutionModel.create(
          [
            {
              orderId: order.id,
              storeId: scope.storeId,
              userId: order.userId,

              originalProductId: line.productId,
              originalProductName: line.productName,
              originalUnitLabel: line.unitLabel,
              originalQuantity: line.quantity,
              chargedUnitPrice: line.unitPrice,

              replacementProductId: replacement._id,
              replacementProductName: replacement.name,
              replacementUnitLabel: formatUnitLabel(replacement.unitType, replacement.unitValue),
              replacementQuantity,
              replacementUnitPrice: replacement.sellingPrice,

              status: SubstitutionStatus.PROPOSED,
              reason: dto.reason,
              note: dto.note?.trim() || null,
              createdByUserId: new Types.ObjectId(scope.actorId),
              createdByRole: scope.actorRole,
            },
          ],
          { session: context.session ?? undefined },
        );

        created = document;
      } catch (error) {
        // The partial unique index is the real authority on "one open proposal
        // per line" — a check-then-write could always lose the race.
        if ((error as { code?: number }).code === 11000) {
          throw BusinessException.substitutionAlreadyOpen(line.productName);
        }
        throw error;
      }

      this.logger.log(
        'Substitution proposed on ' +
          order.orderNumber +
          ': ' +
          line.productName +
          ' -> ' +
          replacement.name,
      );

      return toSubstitutionView(created.toObject<LeanSubstitution>());
    });
  }

  /** A few quantities the charged total divides evenly by, for the error message. */
  private suggestQuantities(lineTotal: number): number[] {
    const options: number[] = [];
    for (let quantity = 1; quantity <= 6 && options.length < 3; quantity += 1) {
      if (lineTotal % quantity === 0) options.push(quantity);
    }
    return options;
  }

  /**
   * The customer's answer.
   *
   * Scoped by `userId` in the filter, so a shopper can only ever answer their
   * own proposals — there is no id they could change to accept somebody else's.
   */
  async decide(
    userId: string,
    substitutionId: string,
    dto: DecideSubstitutionDto,
  ): Promise<SubstitutionView> {
    return this.transactionRunner.run(async (context) => {
      const substitution = await this.substitutionModel
        .findOne({
          _id: new Types.ObjectId(substitutionId),
          userId: new Types.ObjectId(userId),
        })
        .session(context.session)
        .exec();

      if (!substitution) throw new NotFoundException('Substitution not found');

      if (substitution.status !== SubstitutionStatus.PROPOSED) {
        // Someone got there first — the store withdrew it, or a second tab
        // already answered. Reported rather than silently re-applied.
        throw BusinessException.substitutionInvalid(
          'This replacement has already been ' + substitution.status.toLowerCase() + '.',
        );
      }

      if (dto.decision === SubstitutionDecision.ACCEPT) {
        await this.applyAccepted(substitution, context.session);
      } else {
        // Not taken: the replacement goes back on the shelf and the original
        // line stands exactly as it was.
        await this.inventoryService.release(
          substitution.replacementProductId,
          substitution.storeId,
          substitution.replacementQuantity,
          context.session,
        );
      }

      substitution.status =
        dto.decision === SubstitutionDecision.ACCEPT
          ? SubstitutionStatus.ACCEPTED
          : SubstitutionStatus.REJECTED;
      substitution.resolvedAt = new Date();
      substitution.resolvedByRole = Role.CUSTOMER;

      await substitution.save({ session: context.session ?? undefined });

      this.logger.log(
        'Substitution ' + substitutionId + ' ' + substitution.status.toLowerCase() + ' by customer',
      );

      return toSubstitutionView(substitution.toObject<LeanSubstitution>());
    });
  }

  /**
   * Swaps the order line and returns the original's stock.
   *
   * The order document is mutated by OrdersService, which owns it — this service
   * never writes to the orders collection. The original's reserved units go back
   * only now, because until the shopper agreed they were still the right thing
   * to be holding.
   */
  private async applyAccepted(
    substitution: SubstitutionDocument,
    session: Parameters<InventoryService['release']>[3],
  ): Promise<void> {
    await this.ordersService.applySubstitution(
      substitution.orderId,
      {
        originalProductId: substitution.originalProductId,
        replacementProductId: substitution.replacementProductId,
        replacementQuantity: substitution.replacementQuantity,
      },
      session ?? null,
    );

    await this.inventoryService.release(
      substitution.originalProductId,
      substitution.storeId,
      substitution.originalQuantity,
      session,
    );
  }

  /**
   * The store withdrawing its own open proposal — the picker found the original
   * after all, or thought of a better replacement.
   */
  async cancel(
    scope: { storeId: Types.ObjectId; actorRole: Role },
    substitutionId: string,
  ): Promise<SubstitutionView> {
    return this.transactionRunner.run(async (context) => {
      const substitution = await this.substitutionModel
        .findOne({ _id: new Types.ObjectId(substitutionId), storeId: scope.storeId })
        .session(context.session)
        .exec();

      if (!substitution) throw new NotFoundException('Substitution not found');

      if (substitution.status !== SubstitutionStatus.PROPOSED) {
        throw BusinessException.substitutionInvalid(
          'This replacement has already been ' + substitution.status.toLowerCase() + '.',
        );
      }

      await this.inventoryService.release(
        substitution.replacementProductId,
        substitution.storeId,
        substitution.replacementQuantity,
        context.session,
      );

      substitution.status = SubstitutionStatus.CANCELLED;
      substitution.resolvedAt = new Date();
      substitution.resolvedByRole = scope.actorRole;

      await substitution.save({ session: context.session ?? undefined });

      return toSubstitutionView(substitution.toObject<LeanSubstitution>());
    });
  }

  /** Every proposal on one order, scoped to the store that owns it. */
  async listForStoreOrder(storeId: Types.ObjectId, orderId: string): Promise<SubstitutionView[]> {
    const rows = await this.substitutionModel
      .find({ orderId: new Types.ObjectId(orderId), storeId })
      .sort({ createdAt: -1 })
      .lean<LeanSubstitution[]>()
      .exec();

    return rows.map(toSubstitutionView);
  }

  /** Every proposal on one order, scoped to the shopper who owns it. */
  async listForCustomerOrder(userId: string, orderId: string): Promise<SubstitutionView[]> {
    const rows = await this.substitutionModel
      .find({
        orderId: new Types.ObjectId(orderId),
        userId: new Types.ObjectId(userId),
      })
      .sort({ createdAt: -1 })
      .lean<LeanSubstitution[]>()
      .exec();

    return rows.map(toSubstitutionView);
  }

  /** How many proposals are waiting on customers, for the store dashboard. */
  async countOpenForStore(storeId: Types.ObjectId): Promise<number> {
    return this.substitutionModel
      .countDocuments({ storeId, status: SubstitutionStatus.PROPOSED })
      .exec();
  }
}

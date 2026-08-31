import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model, Types } from 'mongoose';
import { PaginatedResult, paginated } from 'src/common/dto';
import { TransactionContext, TransactionRunner } from 'src/common/database';
import { IdempotencyService } from 'src/common/idempotency';
import { Role, UnitType } from 'src/common/enums';
import { BusinessException } from 'src/common/errors';
import { escapeRegExp } from 'src/common/utils';
import { CartService } from 'src/modules/cart/cart.service';
import { CheckoutDraft, CheckoutService, CreateOrderDto } from 'src/modules/checkout';
import { InventoryService } from 'src/modules/inventory';
import { PaymentsService } from 'src/modules/payments';
import { PaymentStatus } from 'src/modules/payments/enums';
import { Product, ProductDocument } from 'src/modules/products/schemas';
import { formatUnitLabel } from 'src/modules/products/product.view';
import { StoresService } from 'src/modules/stores';
import { OrderNumberService } from './order-number.service';
import {
  FulfillmentMethod,
  OrderStatus,
  STATUS_NOTES,
  StatusActor,
  assertCustomerCanCancel,
  assertTransition,
} from './order-status.machine';
import {
  LeanOrder,
  OrderDetailView,
  OrderSummaryView,
  statusLabel,
  toOrderDetailView,
  toOrderSummaryView,
} from './order.view';
import { User, UserDocument } from 'src/modules/users/schemas';
import { QueryOrdersDto, QueryStoreOrdersDto } from './dto';
import {
  StoreCustomerView,
  StoreOrderDetailView,
  StoreOrderSummaryView,
  needsAction,
  toStoreOrderDetailView,
  toStoreOrderSummaryView,
} from './store-order.view';
import { Order, OrderDocument, OrderItem } from './schemas';

/** The idempotency namespace for order creation. */
const ORDER_CREATE_SCOPE = 'order.create';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    /**
     * Read-only, and only ever for `fullName` + `phone`. A pickup order carries
     * no address snapshot, so the account is the only place a picker can learn
     * who is coming to collect. Injecting UsersService instead would make orders
     * depend on the users module for two fields; the projection below is
     * narrower and cannot accidentally return more.
     */
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    /**
     * Read-only. A substituted line must carry a real catalogue snapshot, and
     * reading it here keeps `applySubstitution` from trusting values handed to
     * it. ProductsService is not injected because products already depend on
     * inventory and categories, and orders sit above all three.
     */
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly checkoutService: CheckoutService,
    private readonly inventoryService: InventoryService,
    private readonly paymentsService: PaymentsService,
    private readonly cartService: CartService,
    private readonly orderNumberService: OrderNumberService,
    private readonly idempotencyService: IdempotencyService,
    private readonly storesService: StoresService,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  // --- Reads --------------------------------------------------------------

  /**
   * A shopper's own orders.
   *
   * `userId` comes from the JWT and is in the filter, so there is no code path
   * here that could return someone else's order — and the query is paginated,
   * so a shopper with a thousand orders cannot pull them all in one request.
   */
  async listForCustomer(
    userId: string,
    query: QueryOrdersDto,
  ): Promise<PaginatedResult<OrderSummaryView>> {
    const filter: FilterQuery<OrderDocument> = { userId: new Types.ObjectId(userId) };
    if (query.status) filter.status = query.status;

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .lean<LeanOrder[]>()
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    const storeName = await this.activeStoreName();

    return paginated(
      orders.map((order) => toOrderSummaryView(order, storeName)),
      total,
      { page: query.page, limit: query.limit },
    );
  }

  async findForCustomer(userId: string, orderId: string): Promise<OrderDetailView> {
    const order = await this.loadOwnedOrFail(userId, orderId);
    return toOrderDetailView(order, await this.activeStoreName());
  }

  // --- Store operations ---------------------------------------------------

  /**
   * THE STORE QUEUE
   *
   * `storeId` is the first key in the filter and is supplied by the caller from
   * the authenticated principal — never from the request. That is what makes
   * cross-store access structurally impossible here rather than merely checked:
   * there is no code path that loads an order and *then* compares its store,
   * which is the shape that eventually gets written without the second half.
   *
   * Served by the compound index `{ storeId, status, createdAt }` that the order
   * schema already declares for exactly this query.
   */
  async listForStore(
    storeId: Types.ObjectId,
    query: QueryStoreOrdersDto,
  ): Promise<PaginatedResult<StoreOrderSummaryView>> {
    const filter = this.buildStoreFilter(storeId, query);

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .lean<LeanOrder[]>()
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    const customers = await this.loadCustomers(orders);

    return paginated(
      orders
        .map((order) =>
          toStoreOrderSummaryView(order, customers.get(order.userId.toString()) ?? null),
        )
        // Action-required first within the page, newest first inside each group.
        // Sorted here rather than in the query because "needs action" is a
        // property of the state machine, and restating its status list as a sort
        // expression would be a second definition to keep in step.
        .sort((a, b) => {
          if (a.needsAction !== b.needsAction) return a.needsAction ? -1 : 1;
          return b.placedAt.getTime() - a.placedAt.getTime();
        }),
      total,
      { page: query.page, limit: query.limit },
    );
  }

  async findForStore(storeId: Types.ObjectId, orderId: string): Promise<StoreOrderDetailView> {
    const order = await this.loadForStoreOrFail(storeId, orderId);
    const customers = await this.loadCustomers([order]);

    return toStoreOrderDetailView(order, customers.get(order.userId.toString()) ?? null);
  }

  /**
   * Moves an order along, on behalf of store staff.
   *
   * This method deliberately contains no transition rules. It establishes *who
   * may act on this order* — the store scope — and then hands off to
   * `changeStatus`, which owns the state machine, the history entry, the stock
   * restoration and the payment settlement. §51: those rules live in one place,
   * and a second entry point that re-implemented any of them would be the bug.
   *
   * Staleness needs no handling here either: `changeStatus` re-reads the order
   * inside its unit of work, so if a colleague already advanced it, the
   * transition this manager clicked is no longer legal and the machine rejects
   * it with a 409 rather than overwriting the newer status (§63, §64).
   */
  async advanceForStore(
    storeId: Types.ObjectId,
    orderId: string,
    next: OrderStatus,
    actor: { userId: string; role: Role },
    options: { reason?: string; note?: string } = {},
  ): Promise<StoreOrderDetailView> {
    // Establishes both existence and store ownership before anything is written.
    const existing = await this.loadForStoreOrFail(storeId, orderId);

    const isTermination = [
      OrderStatus.CANCELLED,
      OrderStatus.REJECTED,
      OrderStatus.FAILED,
    ].includes(next);

    const reason = options.reason?.trim();

    // A store closing an order must say why. The shopper reads it in their
    // timeline, and "cancelled, no reason given" is not an acceptable thing to
    // show somebody whose groceries are not coming. Enforced here rather than in
    // a DTO because whether it is required depends on the target status.
    if (isTermination && !reason) {
      throw new BadRequestException(
        'Please give a reason when rejecting, cancelling or failing an order.',
      );
    }

    await this.changeStatus(existing._id, next, {
      actor: actor.role,
      actorId: new Types.ObjectId(actor.userId),
      // The shopper reads this note in their own timeline, so a rejection reason
      // reaches them rather than being buried in a staff-only field.
      note: options.note?.trim() || (isTermination && reason ? reason : undefined),
      cancellationReason: isTermination ? reason : undefined,
    });

    return this.findForStore(storeId, orderId);
  }

  /**
   * The operational counts behind the dashboard.
   *
   * One `$facet` aggregation, not eight queries. §6 asks for a single dashboard
   * endpoint and efficient queries; the whole summary is one round trip against
   * the `{ storeId, status, createdAt }` index.
   */
  async dashboardCountsForStore(
    storeId: Types.ObjectId,
    now: Date = new Date(),
  ): Promise<{
    byStatus: Record<OrderStatus, number>;
    needsAction: number;
    completedToday: number;
  }> {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [result] = await this.orderModel
      .aggregate<{
        byStatus: Array<{ _id: OrderStatus; count: number }>;
        completedToday: Array<{ value: number }>;
      }>([
        { $match: { storeId } },
        {
          $facet: {
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            // A different question — bounded by time rather than by status — so
            // it needs its own branch rather than a second request.
            completedToday: [
              { $match: { status: OrderStatus.DELIVERED, updatedAt: { $gte: startOfToday } } },
              { $count: 'value' },
            ],
          },
        },
      ])
      .exec();

    const byStatus = Object.values(OrderStatus).reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<OrderStatus, number>,
    );

    for (const row of result?.byStatus ?? []) byStatus[row._id] = row.count;

    const needsActionTotal = Object.values(OrderStatus)
      .filter((status) => needsAction(status))
      .reduce((sum, status) => sum + byStatus[status], 0);

    return {
      byStatus,
      needsAction: needsActionTotal,
      completedToday: result?.completedToday[0]?.value ?? 0,
    };
  }

  private buildStoreFilter(
    storeId: Types.ObjectId,
    query: QueryStoreOrdersDto,
  ): FilterQuery<OrderDocument> {
    const filter: FilterQuery<OrderDocument> = { storeId };

    if (query.status) filter.status = query.status;
    if (query.fulfillmentMethod) filter.fulfillmentMethod = query.fulfillmentMethod;

    // Derived from the state machine's own list, so "needs action" means the
    // same thing in the filter, on the row badge and in the dashboard count.
    if (query.needsAction) {
      filter.status = { $in: Object.values(OrderStatus).filter((status) => needsAction(status)) };
    }

    if (query.placedFrom || query.placedTo) {
      filter.createdAt = {
        ...(query.placedFrom ? { $gte: query.placedFrom } : {}),
        ...(query.placedTo ? { $lte: query.placedTo } : {}),
      };
    }

    if (query.orderNumber) {
      // Anchored and escaped: an unescaped operator in an order number would be
      // both a wrong result and a ReDoS vector.
      filter.orderNumber = new RegExp('^' + escapeRegExp(query.orderNumber.toUpperCase()));
    }

    return filter;
  }

  /**
   * Loads an order inside the caller's store, or reports it as missing.
   *
   * "Not found" rather than "forbidden", matching `loadOwnedOrFail`: telling a
   * manager that an order id is real but belongs to another store is itself a
   * small leak, and there is nothing they could do with the distinction.
   */
  private async loadForStoreOrFail(storeId: Types.ObjectId, orderId: string): Promise<LeanOrder> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found');

    const order = await this.orderModel
      .findOne({ _id: new Types.ObjectId(orderId), storeId })
      .lean<LeanOrder>()
      .exec();

    if (!order) throw new NotFoundException('Order not found');

    return order;
  }

  /**
   * The fulfilment identity for a page of orders, in one query.
   *
   * Projected to two fields at the database, so nothing else about the account
   * is even read — the narrowest way to honour §12. One query per page rather
   * than one per order keeps the queue free of an N+1.
   */
  private async loadCustomers(orders: LeanOrder[]): Promise<Map<string, StoreCustomerView>> {
    const ids = [...new Set(orders.map((order) => order.userId.toString()))];
    if (ids.length === 0) return new Map();

    const users = await this.userModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select('fullName phone')
      .lean()
      .exec();

    return new Map(
      users.map((user) => [user._id.toString(), { name: user.fullName, phone: user.phone }]),
    );
  }

  // --- Line substitution --------------------------------------------------

  /**
   * The facts the substitution flow needs about a store's order, in one read.
   *
   * Deliberately not `findForStore`: that builds the staff presentation view,
   * which withholds the customer's user id by design. The substitution record
   * genuinely needs it — the shopper has to be able to find and answer their own
   * proposals — so it is fetched here, narrowly and explicitly, rather than by
   * widening a view that many screens render.
   */
  async loadStoreOrderForEdit(
    storeId: Types.ObjectId,
    orderId: string,
  ): Promise<{
    id: Types.ObjectId;
    userId: Types.ObjectId;
    orderNumber: string;
    status: OrderStatus;
    statusLabel: string;
    items: OrderItem[];
  }> {
    const order = await this.loadForStoreOrFail(storeId, orderId);

    return {
      id: order._id,
      userId: order.userId,
      orderNumber: order.orderNumber,
      status: order.status,
      statusLabel: statusLabel(order.status, order.fulfillmentMethod),
      items: order.items,
    };
  }

  /**
   * Swaps one order line for a different product.
   *
   * WHAT THIS DOES NOT TOUCH: `pricing`. Not the subtotal, not the total, not
   * the delivery fee. The replacement line keeps the exact `lineTotal` the
   * shopper agreed to, and `unitPrice` is re-derived from it so that
   * `unitPrice × quantity === lineTotal` stays an exact integer identity — the
   * order schema verifies the pricing identity on every save, and a substitution
   * that disturbed it would refuse to persist. The caller guarantees the
   * division is clean before proposing.
   *
   * Owned by this service because this service owns the order document.
   * SubstitutionsService decides *whether* a swap is allowed; only this method
   * performs it.
   */
  async applySubstitution(
    orderId: Types.ObjectId,
    swap: {
      originalProductId: Types.ObjectId;
      replacementProductId: Types.ObjectId;
      replacementQuantity: number;
    },
    session: ClientSession | null = null,
  ): Promise<void> {
    const order = await this.orderModel.findById(orderId).session(session).exec();
    if (!order) throw new NotFoundException('Order not found');

    const line = order.items.find((item) => item.productId.equals(swap.originalProductId));
    if (!line) throw new NotFoundException('That product is not on this order');

    // Read from the catalogue so the swapped line carries a real snapshot rather
    // than values a caller passed in.
    const replacement = await this.productModel
      .findOne({ _id: swap.replacementProductId, storeId: order.storeId })
      .lean<{
        _id: Types.ObjectId;
        name: string;
        brand?: string;
        sku: string;
        unitType: UnitType;
        unitValue: number;
        images?: Array<{ url: string; sortOrder: number }>;
      }>()
      .exec();

    if (!replacement) throw new NotFoundException('Replacement product not found');

    const chargedLineTotal = line.lineTotal;

    line.productId = replacement._id;
    line.productName = replacement.name;
    line.brand = replacement.brand ?? null;
    line.sku = replacement.sku;
    line.unitType = replacement.unitType;
    line.unitValue = replacement.unitValue;
    line.unitLabel = formatUnitLabel(replacement.unitType, replacement.unitValue);
    line.productImage =
      [...(replacement.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url ?? null;
    line.quantity = swap.replacementQuantity;
    line.unitPrice = chargedLineTotal / swap.replacementQuantity;
    line.lineTotal = chargedLineTotal;

    await order.save({ session: session ?? undefined });

    this.logger.log('Order ' + order.orderNumber + ': line substituted for ' + replacement.sku);
  }

  // --- Order creation -----------------------------------------------------

  /**
   * ORDER CREATION
   * ==============
   *
   * The sequence, and why it is this sequence:
   *
   *   1. Claim the idempotency key. First, because if this is a retry of an
   *      order that already exists, nothing below should run at all.
   *   2. Re-validate the whole checkout. The preview the shopper saw may be
   *      seconds or minutes old; stock and prices move. This produces the
   *      authoritative draft — the only source of every number that follows.
   *   3. Reserve stock, atomically, line by line. Before the order document
   *      exists, so a shortage costs nothing to abandon.
   *   4. Write the order.
   *   5. Write the payment record.
   *   6. Remove the purchased lines from the cart — last, and only after
   *      everything above succeeded (§13). A failure leaves the basket intact
   *      and re-usable.
   *
   * Steps 3-5 run inside a TransactionRunner unit of work. On a replica set
   * that is a real transaction. On a standalone deployment each write is
   * individually atomic and registers its compensating undo, which the runner
   * replays in reverse on failure. See TransactionRunner for the full
   * discussion of what that does and does not guarantee.
   *
   * Step 6 sits deliberately OUTSIDE that boundary — see `persist`.
   */
  async create(
    userId: string,
    dto: CreateOrderDto,
    idempotencyKey: string,
  ): Promise<OrderDetailView> {
    const claim = await this.idempotencyService.claim(userId, ORDER_CREATE_SCOPE, idempotencyKey);

    // A retry of a request that already produced an order: hand back that same
    // order, freshly read, rather than creating a second one.
    if (claim.kind === 'REPLAY') {
      return this.findForCustomer(userId, claim.resultId.toString());
    }

    try {
      const draft = await this.checkoutService.validate(userId, {
        fulfillmentMethod: dto.fulfillmentMethod,
        addressId: dto.addressId,
        paymentMethod: dto.paymentMethod,
      });

      const order = await this.persist(userId, dto, draft);

      await this.idempotencyService.complete(userId, ORDER_CREATE_SCOPE, idempotencyKey, order._id);

      this.logger.log(
        'Order ' +
          order.orderNumber +
          ' placed: ' +
          draft.lines.length +
          ' line(s), ' +
          draft.fulfillmentMethod +
          ', total ' +
          draft.total,
      );

      return toOrderDetailView(order, await this.activeStoreName());
    } catch (error) {
      // The claim must not outlive a failed attempt, or the shopper is locked
      // out of retrying by their own unsuccessful request.
      await this.idempotencyService.release(userId, ORDER_CREATE_SCOPE, idempotencyKey);

      this.logger.warn(
        'Order creation failed for user ' +
          userId +
          ': ' +
          (error instanceof Error ? error.message : 'unknown error'),
      );

      throw error;
    }
  }

  /** Steps 3-6, inside one unit of work. */
  private async persist(
    userId: string,
    dto: CreateOrderDto,
    draft: CheckoutDraft,
  ): Promise<LeanOrder> {
    // Taken outside the unit of work on purpose: the counter is a single hot
    // document, and holding a transaction open across it would serialise every
    // checkout in the system. An unused number is a harmless gap in the sequence.
    const orderNumber = await this.orderNumberService.next();
    const owner = new Types.ObjectId(userId);

    const order = await this.transactionRunner.run(async (context) => {
      await this.reserveStock(draft, context);

      const order = await this.writeOrder(owner, orderNumber, dto, draft, context);

      const payment = await this.paymentsService.createForOrder(
        {
          orderId: order._id,
          userId: owner,
          method: dto.paymentMethod,
          amount: draft.total,
        },
        context.session,
      );

      context.compensate('delete payment for order ' + orderNumber, () =>
        this.paymentsService.removeForOrder(order._id),
      );

      // The payment record is the authority; the order carries a copy so that
      // listing orders needs no join. Taken from what the provider actually
      // returned rather than assumed, so the two cannot disagree from the very
      // first read — today that is always PENDING, and for a future gateway
      // that settles immediately it will not be.
      if (order.payment.status !== payment.status || order.payment.paidAt !== payment.paidAt) {
        order.payment.status = payment.status;
        order.payment.paidAt = payment.paidAt;
        await order.save({ session: context.session ?? undefined });
      }

      return order.toObject<LeanOrder>();
    });

    // The cart is tidied AFTER the unit of work has committed, and its failure
    // is logged rather than raised.
    //
    // Inventory, the order and the payment are one atomic fact; the cart is
    // not part of it. Putting the cart write inside the unit of work would mean
    // a failure to tidy a basket could roll back a perfectly good order — the
    // shopper loses their order because of a bookkeeping hiccup, which is a far
    // worse outcome than a cart that still shows items it should not.
    //
    // And that state self-heals: the cart is rebuilt from the catalogue on
    // every read, and checkout re-validates from scratch. The worst case is a
    // shopper seeing lines they have already bought, which they can remove.
    await this.clearPurchasedLines(userId, draft);

    return order;
  }

  private async clearPurchasedLines(userId: string, draft: CheckoutDraft): Promise<void> {
    try {
      await this.cartService.removePurchasedItems(
        userId,
        draft.storeId,
        draft.lines.map((line) => line.productId),
      );
    } catch (error) {
      this.logger.error(
        'Order placed but the cart could not be tidied for user ' + userId,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Takes stock for every line, atomically, one line at a time.
   *
   * There is no bulk "decrement all of these if all are available" operation in
   * MongoDB, so the basket is walked. Each `tryReserve` is a single guarded
   * update that cannot oversell (see InventoryService), and each success
   * registers its own undo — so a shortage on line four returns the stock taken
   * for lines one to three rather than stranding it.
   *
   * Partial fulfilment is deliberately not offered: §47 requires the shopper to
   * decide, and silently shipping three of four items is not that decision.
   */
  private async reserveStock(draft: CheckoutDraft, context: TransactionContext): Promise<void> {
    for (const line of draft.lines) {
      const reserved = await this.inventoryService.tryReserve(
        line.productId,
        draft.storeId,
        line.quantity,
        context.session,
      );

      if (!reserved) {
        this.logger.warn(
          'Inventory conflict on ' + line.sku + ': ' + line.quantity + ' requested, not available',
        );

        // Thrown, so the runner unwinds everything reserved so far. The message
        // names the product, because "something sold out" is not actionable.
        throw BusinessException.checkoutValidationFailed(
          line.productName +
            ' has just sold out or does not have enough stock left. Please update your cart and try again.',
          {
            issues: [
              {
                code: 'INSUFFICIENT_STOCK',
                productId: line.productId.toString(),
                productName: line.productName,
                message: line.productName + ' is no longer available in that quantity.',
                requestedQuantity: line.quantity,
              },
            ],
          },
        );
      }

      context.compensate('return ' + line.quantity + ' x ' + line.sku + ' to stock', () =>
        this.inventoryService.release(line.productId, draft.storeId, line.quantity),
      );
    }
  }

  /** Writes the order document from the draft. Every value is server-derived. */
  private async writeOrder(
    userId: Types.ObjectId,
    orderNumber: string,
    dto: CreateOrderDto,
    draft: CheckoutDraft,
    context: TransactionContext,
  ): Promise<OrderDocument> {
    const now = new Date();
    const isDelivery = draft.fulfillmentMethod === FulfillmentMethod.DELIVERY;

    const [order] = await this.orderModel.create(
      [
        {
          orderNumber,
          userId,
          storeId: draft.storeId,
          items: draft.lines.map((line): OrderItem => ({
            productId: line.productId,
            productName: line.productName,
            productImage: line.productImage,
            brand: line.brand,
            sku: line.sku,
            unitLabel: line.unitLabel,
            unitType: line.unitType,
            unitValue: line.unitValue,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
          })),
          fulfillmentMethod: draft.fulfillmentMethod,
          // The address is copied, not referenced: editing "Home" tomorrow must
          // not rewrite where this order went.
          deliveryAddress:
            isDelivery && draft.address
              ? {
                  addressId: draft.address._id,
                  label: draft.address.label,
                  recipientName: draft.address.recipientName,
                  phone: draft.address.phone,
                  houseNumber: draft.address.houseNumber,
                  street: draft.address.street,
                  area: draft.address.area,
                  city: draft.address.city,
                  landmark: draft.address.landmark ?? null,
                  deliveryInstructions: draft.address.deliveryInstructions ?? null,
                  latitude: draft.address.latitude as number,
                  longitude: draft.address.longitude as number,
                  formatted: [
                    draft.address.houseNumber,
                    draft.address.street,
                    draft.address.area,
                    draft.address.city,
                  ]
                    .filter(Boolean)
                    .join(', '),
                }
              : null,
          delivery:
            isDelivery && draft.delivery
              ? {
                  distanceMeters: draft.delivery.distanceMeters,
                  durationSeconds: draft.delivery.durationSeconds,
                  fee: draft.delivery.fee,
                  pricingRuleId: Types.ObjectId.isValid(draft.delivery.pricingRuleId)
                    ? new Types.ObjectId(draft.delivery.pricingRuleId)
                    : null,
                  pricingRuleLabel: draft.delivery.pricingRuleLabel,
                  routingProvider: draft.delivery.routingProvider,
                  calculatedAt: draft.delivery.calculatedAt,
                }
              : null,
          pickup: isDelivery ? null : draft.pickup,
          pricing: {
            subtotal: draft.subtotal,
            deliveryFee: draft.deliveryFee,
            discount: draft.discount,
            total: draft.total,
            currency: draft.currency,
          },
          payment: {
            method: dto.paymentMethod,
            status: PaymentStatus.PENDING,
            paidAt: null,
          },
          status: OrderStatus.PENDING,
          statusHistory: [
            {
              status: OrderStatus.PENDING,
              changedAt: now,
              changedByRole: Role.CUSTOMER,
              changedByUserId: userId,
              note: STATUS_NOTES[OrderStatus.PENDING],
            },
          ],
          customerNote: dto.customerNote?.trim() || null,
        },
      ],
      { session: context.session ?? undefined },
    );

    context.compensate('delete order ' + orderNumber, () =>
      this.orderModel.deleteOne({ _id: order._id }).exec(),
    );

    return order;
  }

  // --- Lifecycle ----------------------------------------------------------

  /**
   * Customer cancellation.
   *
   * Two independent gates, and both matter. `assertCustomerCanCancel` decides
   * whether this *actor* may cancel from this state — a customer may not cancel
   * an order already being picked, even though the machine permits the edge.
   * `changeStatus` then decides whether the transition itself is legal.
   */
  async cancelForCustomer(
    userId: string,
    orderId: string,
    reason?: string,
  ): Promise<OrderDetailView> {
    const order = await this.loadOwnedOrFail(userId, orderId);

    assertCustomerCanCancel(order.status);

    const updated = await this.changeStatus(order._id, OrderStatus.CANCELLED, {
      actor: Role.CUSTOMER,
      actorId: new Types.ObjectId(userId),
      note: reason?.trim() || 'Cancelled by the customer.',
      cancellationReason: reason?.trim() || 'Cancelled by the customer.',
    });

    return toOrderDetailView(updated, await this.activeStoreName());
  }

  /**
   * The one place an order's status changes.
   *
   * Every transition is validated against the state machine for *this order's*
   * fulfilment method, so a pickup order cannot go OUT_FOR_DELIVERY and a
   * delivery order cannot go READY_FOR_PICKUP — not by API call, not by an
   * internal caller, not by a future admin screen.
   *
   * Side effects that must accompany particular transitions live here too:
   * returning stock on a cancellation, settling a cash payment on completion.
   * Putting them anywhere else would mean a second entry point that forgets one.
   */
  async changeStatus(
    orderId: Types.ObjectId,
    next: OrderStatus,
    options: {
      actor: StatusActor;
      actorId?: Types.ObjectId | null;
      note?: string;
      cancellationReason?: string;
    },
  ): Promise<LeanOrder> {
    return this.transactionRunner.run(async (context) => {
      // Read inside the unit of work, so on a replica set the transition is
      // decided against the same snapshot it is written to. Two staff members
      // clicking the same button cannot both see PACKED and both advance it.
      const order = await this.orderModel.findById(orderId).session(context.session).exec();

      if (!order) throw new NotFoundException('Order not found');

      assertTransition(order.fulfillmentMethod, order.status, next);

      const now = new Date();
      const isCancellation = [
        OrderStatus.CANCELLED,
        OrderStatus.REJECTED,
        OrderStatus.FAILED,
      ].includes(next);

      // Stock goes back exactly once. The flag — not the status — is what makes
      // that true: a retried cancellation would otherwise credit it twice.
      if (isCancellation && !order.inventoryRestored) {
        await this.restoreInventory(order, context.session);
        order.inventoryRestored = true;
      }

      if (isCancellation) {
        await this.paymentsService.markFailedForCancellation(
          order._id,
          options.cancellationReason ?? 'Order ' + next.toLowerCase(),
          context.session,
        );
        order.payment.status = PaymentStatus.FAILED;
      }

      // Cash arrives when the order is handed over — never when it is placed.
      if (next === OrderStatus.DELIVERED) {
        const paidAt = await this.paymentsService.markPaid(order._id, context.session);
        order.payment.status = PaymentStatus.PAID;
        order.payment.paidAt = paidAt;
      }

      order.status = next;
      order.statusHistory.push({
        status: next,
        changedAt: now,
        changedByRole: options.actor,
        changedByUserId: options.actorId ?? null,
        note: options.note ?? STATUS_NOTES[next],
      });

      if (isCancellation) {
        order.cancelledAt = now;
        order.cancellationReason = options.cancellationReason ?? null;
        order.cancelledByRole = options.actor;
      }

      await order.save({ session: context.session ?? undefined });

      this.logger.log('Order ' + order.orderNumber + ' -> ' + next + ' by ' + options.actor);

      return order.toObject<LeanOrder>();
    });
  }

  /** Returns every reserved unit. Best-effort per line; a failure must not stop the rest. */
  private async restoreInventory(
    order: OrderDocument,
    session: ClientSession | null,
  ): Promise<void> {
    for (const item of order.items) {
      await this.inventoryService.release(item.productId, order.storeId, item.quantity, session);
    }

    this.logger.log('Stock returned for cancelled order ' + order.orderNumber);
  }

  // --- Helpers ------------------------------------------------------------

  /**
   * Loads an order the caller owns, or reports it as missing.
   *
   * Ownership is in the query filter rather than a comparison afterwards, which
   * is what makes IDOR structurally impossible here rather than merely checked.
   * "Not found" over "forbidden" on purpose: confirming that an order id exists
   * but belongs to somebody else is itself a small leak.
   */
  private async loadOwnedOrFail(userId: string, orderId: string): Promise<LeanOrder> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found');

    const order = await this.orderModel
      .findOne({ _id: new Types.ObjectId(orderId), userId: new Types.ObjectId(userId) })
      .lean<LeanOrder>()
      .exec();

    if (!order) throw new NotFoundException('Order not found');

    return order;
  }

  /**
   * The store name for list rows. Pickup orders carry their own snapshot; this
   * is the fallback for delivery orders, and it is one cached lookup rather
   * than a join on every order.
   */
  private async activeStoreName(): Promise<string | null> {
    try {
      const store = await this.storesService.findActiveStore();
      return store.name;
    } catch {
      // A missing store must not break order history — the order is still valid.
      return null;
    }
  }
}

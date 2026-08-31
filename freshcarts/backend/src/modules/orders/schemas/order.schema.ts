import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Role, UnitType } from 'src/common/enums';
import { AddressLabel } from 'src/modules/addresses/schemas';
import { PaymentMethod, PaymentStatus } from 'src/modules/payments/enums';
import { FulfillmentMethod, OrderStatus } from '../order-status.machine';

export type OrderDocument = HydratedDocument<Order>;

export const ORDER_COLLECTION = 'orders';

/**
 * ORDER ITEM SNAPSHOT
 *
 * A line records what was bought, as it was at the moment of buying. Name,
 * image, unit and price are copied — not referenced — so an order stays
 * readable when the product is renamed, repriced, re-photographed, deactivated
 * or dropped from the catalogue entirely.
 *
 * `productId` is kept, but only as a link ("buy this again", "what did we sell
 * of this?"). No display or arithmetic reads through it. Rebuilding a six-month
 * -old receipt from today's Product documents would show today's prices beside
 * a total that no longer adds up.
 */
@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 160 })
  productName: string;

  /** Nullable: a product may genuinely have had no image when it was sold. */
  @Prop({ type: String, default: null, maxlength: 600 })
  productImage: string | null;

  @Prop({ type: String, default: null, maxlength: 80 })
  brand: string | null;

  @Prop({ type: String, required: true, maxlength: 40 })
  sku: string;

  /** Pack size as it read on the shelf: "1 L", "500 g". Already formatted. */
  @Prop({ type: String, required: true, maxlength: 40 })
  unitLabel: string;

  @Prop({ type: String, required: true, enum: Object.values(UnitType) })
  unitType: UnitType;

  @Prop({ type: Number, required: true, min: 0 })
  unitValue: number;

  @Prop({ type: Number, required: true, min: 1 })
  quantity: number;

  /** Whole PKR, the price charged. Never re-read from the catalogue. */
  @Prop({ type: Number, required: true, min: 0 })
  unitPrice: number;

  /** unitPrice × quantity, stored so a receipt never depends on re-deriving it. */
  @Prop({ type: Number, required: true, min: 0 })
  lineTotal: number;
}

const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

/**
 * ADDRESS SNAPSHOT
 *
 * Copied from the address book at order time. §17: `addressId` alone is not
 * enough, because the shopper may edit "Home" tomorrow — and then last week's
 * order would claim to have been delivered somewhere it never went.
 */
@Schema({ _id: false })
export class OrderAddressSnapshot {
  /** Link back to the saved address, for "deliver here again". May be deleted. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Address', default: null })
  addressId: Types.ObjectId | null;

  @Prop({ type: String, enum: Object.values(AddressLabel), default: AddressLabel.OTHER })
  label: AddressLabel;

  @Prop({ type: String, required: true, maxlength: 80 })
  recipientName: string;

  @Prop({ type: String, required: true, maxlength: 20 })
  phone: string;

  @Prop({ type: String, required: true, maxlength: 60 })
  houseNumber: string;

  @Prop({ type: String, required: true, maxlength: 120 })
  street: string;

  @Prop({ type: String, required: true, maxlength: 100 })
  area: string;

  @Prop({ type: String, required: true, maxlength: 80 })
  city: string;

  @Prop({ type: String, default: null, maxlength: 160 })
  landmark: string | null;

  @Prop({ type: String, default: null, maxlength: 300 })
  deliveryInstructions: string | null;

  @Prop({ type: Number, required: true })
  latitude: number;

  @Prop({ type: Number, required: true })
  longitude: number;

  /** Pre-rendered single line, so every surface shows it identically. */
  @Prop({ type: String, required: true, maxlength: 500 })
  formatted: string;
}

const OrderAddressSnapshotSchema = SchemaFactory.createForClass(OrderAddressSnapshot);

/**
 * DELIVERY SNAPSHOT
 *
 * The measurement and the price that came from it, frozen. §27: none of this
 * may move if pricing is retuned, the shopper edits the address, the store
 * relocates or the routing provider is swapped.
 *
 * `pricingRuleId` is recorded for auditing — "why was this Rs. 120?" has an
 * answer — but the fee is never recomputed from the rule.
 */
@Schema({ _id: false })
export class OrderDeliverySnapshot {
  @Prop({ type: Number, required: true, min: 0 })
  distanceMeters: number;

  @Prop({ type: Number, default: null, min: 0 })
  durationSeconds: number | null;

  @Prop({ type: Number, required: true, min: 0 })
  fee: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'DeliveryPricingRule', default: null })
  pricingRuleId: Types.ObjectId | null;

  @Prop({ type: String, default: null, maxlength: 60 })
  pricingRuleLabel: string | null;

  /** Which implementation measured this, for later reconciliation. */
  @Prop({ type: String, required: true, maxlength: 40 })
  routingProvider: string;

  @Prop({ type: Date, required: true })
  calculatedAt: Date;
}

const OrderDeliverySnapshotSchema = SchemaFactory.createForClass(OrderDeliverySnapshot);

/**
 * PICKUP SNAPSHOT
 *
 * Where and how to collect, as it stood when the order was placed. A store can
 * move or change its phone number; the order must still say where the shopper
 * was told to go.
 */
@Schema({ _id: false })
export class OrderPickupSnapshot {
  @Prop({ type: String, required: true, maxlength: 120 })
  storeName: string;

  @Prop({ type: String, required: true, maxlength: 500 })
  storeAddress: string;

  @Prop({ type: String, required: true, maxlength: 20 })
  storePhone: string;

  @Prop({ type: Number, default: null })
  latitude: number | null;

  @Prop({ type: Number, default: null })
  longitude: number | null;

  @Prop({ type: String, default: null, maxlength: 300 })
  instructions: string | null;
}

const OrderPickupSnapshotSchema = SchemaFactory.createForClass(OrderPickupSnapshot);

/**
 * PRICING SNAPSHOT
 *
 * The arithmetic of the order, computed once by the server and stored. Whole
 * rupees throughout, so `subtotal + deliveryFee - discount === total` is an
 * exact integer identity that the schema hook below actually verifies.
 */
@Schema({ _id: false })
export class OrderPricing {
  @Prop({ type: Number, required: true, min: 0 })
  subtotal: number;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  deliveryFee: number;

  /** Reserved for the coupons milestone. Always 0 today, never null. */
  @Prop({ type: Number, required: true, min: 0, default: 0 })
  discount: number;

  @Prop({ type: Number, required: true, min: 0 })
  total: number;

  @Prop({ type: String, required: true, default: 'PKR', maxlength: 3 })
  currency: string;
}

const OrderPricingSchema = SchemaFactory.createForClass(OrderPricing);

/**
 * PAYMENT SUMMARY
 *
 * A copy of what the Payment document says, denormalised onto the order so
 * listing twenty orders does not mean twenty joins. The Payment collection
 * stays the authority; PaymentsService updates both together.
 */
@Schema({ _id: false })
export class OrderPaymentSummary {
  @Prop({ type: String, required: true, enum: Object.values(PaymentMethod) })
  method: PaymentMethod;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Prop({ type: Date, default: null })
  paidAt: Date | null;
}

const OrderPaymentSummarySchema = SchemaFactory.createForClass(OrderPaymentSummary);

/**
 * STATUS HISTORY ENTRY
 *
 * Append-only in practice: OrdersService only ever `$push`es, and no
 * customer-facing endpoint can write here. It is what makes the customer
 * timeline real rather than inferred, and what lets staff answer "when did this
 * actually happen, and who did it?".
 */
@Schema({ _id: false })
export class OrderStatusHistoryEntry {
  @Prop({ type: String, required: true, enum: Object.values(OrderStatus) })
  status: OrderStatus;

  @Prop({ type: Date, required: true })
  changedAt: Date;

  /** The role that acted, or SYSTEM. Never a name — this is an audit trail, not a byline. */
  @Prop({ type: String, required: true, maxlength: 20 })
  changedByRole: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  changedByUserId: Types.ObjectId | null;

  /** Shopper-facing sentence. Shown verbatim in the timeline. */
  @Prop({ type: String, required: true, maxlength: 300 })
  note: string;
}

const OrderStatusHistoryEntrySchema = SchemaFactory.createForClass(OrderStatusHistoryEntry);

@Schema({
  timestamps: true,
  collection: ORDER_COLLECTION,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      return ret;
    },
  },
})
export class Order {
  /** Human-facing identifier, e.g. FC-2026-0001482. Unique, never an ObjectId. */
  @Prop({ type: String, required: true, uppercase: true, trim: true, maxlength: 32 })
  orderNumber: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Store', required: true })
  storeId: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @Prop({ type: String, required: true, enum: Object.values(FulfillmentMethod) })
  fulfillmentMethod: FulfillmentMethod;

  /** Present for DELIVERY orders only — enforced by the hook below. */
  @Prop({ type: OrderAddressSnapshotSchema, default: null })
  deliveryAddress: OrderAddressSnapshot | null;

  @Prop({ type: OrderDeliverySnapshotSchema, default: null })
  delivery: OrderDeliverySnapshot | null;

  /** Present for PICKUP orders only. */
  @Prop({ type: OrderPickupSnapshotSchema, default: null })
  pickup: OrderPickupSnapshot | null;

  @Prop({ type: OrderPricingSchema, required: true })
  pricing: OrderPricing;

  @Prop({ type: OrderPaymentSummarySchema, required: true })
  payment: OrderPaymentSummary;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(OrderStatus),
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Prop({ type: [OrderStatusHistoryEntrySchema], default: [] })
  statusHistory: OrderStatusHistoryEntry[];

  /** Free-text note from the shopper at checkout ("please ring twice"). */
  @Prop({ type: String, default: null, maxlength: 500 })
  customerNote: string | null;

  // --- Cancellation ------------------------------------------------------

  @Prop({ type: Date, default: null })
  cancelledAt: Date | null;

  @Prop({ type: String, default: null, maxlength: 300 })
  cancellationReason: string | null;

  @Prop({ type: String, enum: [...Object.values(Role), 'SYSTEM'], default: null })
  cancelledByRole: string | null;

  /**
   * Whether the stock taken for this order has been returned.
   *
   * A flag rather than an inference from `status`: restoration is a separate
   * write from the status change, and without a marker a retried cancellation
   * would credit the stock twice.
   */
  @Prop({ type: Boolean, default: false })
  inventoryRestored: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// --- Indexes -------------------------------------------------------------
// Each one exists for a query the application actually issues.

// Customer order history: "my orders, newest first" — the most frequent read.
OrderSchema.index({ userId: 1, createdAt: -1 });

// The customer-facing lookup, and the uniqueness guarantee behind order numbers.
OrderSchema.index({ orderNumber: 1 }, { unique: true });

// Store queue: "what is open right now?", newest first. Serves the store
// dashboard that arrives next milestone, and costs nothing to create now.
OrderSchema.index({ storeId: 1, status: 1, createdAt: -1 });

// A shopper filtering their own history by status.
OrderSchema.index({ userId: 1, status: 1, createdAt: -1 });

/**
 * Structural invariants, enforced at the persistence layer so no write path can
 * bypass them.
 *
 * `invalidate` rather than `next(new Error(...))`: that produces a real
 * ValidationError, which the exception filter renders as a 400 naming the
 * offending field, instead of an opaque 500.
 */
OrderSchema.pre('validate', function (next) {
  const isDelivery = this.fulfillmentMethod === FulfillmentMethod.DELIVERY;

  // A delivery order without an address or a measured distance is not a
  // deliverable order, and a pickup order carrying either is a bug that would
  // show a shopper a delivery fee they were never charged.
  if (isDelivery) {
    if (!this.deliveryAddress) {
      this.invalidate('deliveryAddress', 'A delivery order must carry an address snapshot');
    }
    if (!this.delivery) {
      this.invalidate('delivery', 'A delivery order must carry a delivery snapshot');
    }
    if (this.pickup) {
      this.invalidate('pickup', 'A delivery order must not carry pickup details');
    }
  } else {
    if (!this.pickup) {
      this.invalidate('pickup', 'A pickup order must carry the collection details');
    }
    if (this.deliveryAddress || this.delivery) {
      this.invalidate(
        'deliveryAddress',
        'A pickup order must not carry a delivery address or a delivery fee',
      );
    }
    if (this.pricing && this.pricing.deliveryFee !== 0) {
      this.invalidate('pricing.deliveryFee', 'A pickup order cannot have a delivery fee');
    }
  }

  if (!this.items || this.items.length === 0) {
    this.invalidate('items', 'An order must contain at least one item');
  }

  // The money must add up. Integers throughout, so this is exact — if it ever
  // fails, a pricing path has drifted and the order must not be written.
  if (this.pricing) {
    const expected =
      this.pricing.subtotal + this.pricing.deliveryFee - (this.pricing.discount ?? 0);

    if (this.pricing.total !== expected) {
      this.invalidate('pricing.total', 'Order total must equal subtotal + delivery fee - discount');
    }
  }

  return next();
});

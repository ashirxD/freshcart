import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type SubstitutionDocument = HydratedDocument<Substitution>;

export const SUBSTITUTION_COLLECTION = 'substitutions';

/**
 * The life of a proposal.
 *
 * PROPOSED  — the store has set the replacement aside and is waiting.
 * ACCEPTED  — the customer agreed; the order line has been swapped.
 * REJECTED  — the customer said no; the original line stands.
 * CANCELLED — the store withdrew the proposal before it was answered.
 *
 * Only PROPOSED is open. Everything else is terminal, which is what the partial
 * unique index below relies on to allow a second attempt after a rejection while
 * still forbidding two live proposals on the same line.
 */
export enum SubstitutionStatus {
  PROPOSED = 'PROPOSED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/** Why the original could not be supplied. A short controlled list. */
export enum SubstitutionReason {
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  DAMAGED = 'DAMAGED',
  EXPIRED = 'EXPIRED',
  QUALITY = 'QUALITY',
  OTHER = 'OTHER',
}

/**
 * A proposed swap of one order line for a different product.
 *
 * WHICH LINE
 * ==========
 * The line is identified by `originalProductId`, not by an item `_id`. Order
 * items are embedded subdocuments declared `_id: false` by the order schema, and
 * a product appears at most once per order (the cart is keyed by product), so
 * `(orderId, originalProductId)` names the line uniquely. Adding `_id` to the
 * item subdocument purely to reference it would change a schema that historical
 * orders were written against, for no gain.
 *
 * THE PRICE RULE
 * ==============
 * A substitution never increases what the customer pays. See
 * `SubstitutionsService` for the reasoning; the fields here record the
 * consequence: `chargedUnitPrice` is copied from the *original* line and is what
 * the order keeps charging after an accepted swap. `replacementUnitPrice` is
 * kept alongside it purely so the store can see the difference it absorbed.
 */
@Schema({
  timestamps: true,
  collection: SUBSTITUTION_COLLECTION,
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
export class Substitution {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  /** Denormalised so the store's substitution list needs no join to scope itself. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Store', required: true })
  storeId: Types.ObjectId;

  /** The shopper who must answer. Scopes the customer-facing endpoints. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // --- The line being replaced -------------------------------------------

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true })
  originalProductId: Types.ObjectId;

  /** Snapshot, so the record stays readable if the product is renamed or removed. */
  @Prop({ type: String, required: true, maxlength: 160 })
  originalProductName: string;

  @Prop({ type: String, required: true, maxlength: 40 })
  originalUnitLabel: string;

  @Prop({ type: Number, required: true, min: 1 })
  originalQuantity: number;

  /** What the customer agreed to pay per unit. Survives the swap unchanged. */
  @Prop({ type: Number, required: true, min: 0 })
  chargedUnitPrice: number;

  // --- The replacement ----------------------------------------------------

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true })
  replacementProductId: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 160 })
  replacementProductName: string;

  @Prop({ type: String, required: true, maxlength: 40 })
  replacementUnitLabel: string;

  @Prop({ type: Number, required: true, min: 1 })
  replacementQuantity: number;

  /** The replacement's catalogue price. Recorded for the store, never charged. */
  @Prop({ type: Number, required: true, min: 0 })
  replacementUnitPrice: number;

  // --- Lifecycle ----------------------------------------------------------

  @Prop({
    type: String,
    required: true,
    enum: Object.values(SubstitutionStatus),
    default: SubstitutionStatus.PROPOSED,
  })
  status: SubstitutionStatus;

  @Prop({ type: String, required: true, enum: Object.values(SubstitutionReason) })
  reason: SubstitutionReason;

  /** Optional operator note shown to the shopper alongside the proposal. */
  @Prop({ type: String, default: null, maxlength: 300 })
  note: string | null;

  /** From the verified principal. Never accepted from a request body (§54). */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdByUserId: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 20 })
  createdByRole: string;

  @Prop({ type: Date, default: null })
  resolvedAt: Date | null;

  /** Who closed it: the customer accepting/rejecting, or the store withdrawing. */
  @Prop({ type: String, default: null, maxlength: 20 })
  resolvedByRole: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export const SubstitutionSchema = SchemaFactory.createForClass(Substitution);

// --- Indexes -------------------------------------------------------------

// "The proposals on this order" — read by both the store and the customer.
SubstitutionSchema.index({ orderId: 1, status: 1 });

// The store's cross-order view of what is waiting on customers.
SubstitutionSchema.index({ storeId: 1, status: 1, createdAt: -1 });

// The shopper's "anything waiting for me?" check.
SubstitutionSchema.index({ userId: 1, status: 1, createdAt: -1 });

/**
 * At most one OPEN proposal per order line.
 *
 * A partial unique index rather than an application check, so two managers
 * clicking at the same moment cannot both create one. Scoped to PROPOSED so a
 * rejected proposal does not block a second, better suggestion — which is
 * exactly the flow a picker needs when the first replacement is refused.
 */
SubstitutionSchema.index(
  { orderId: 1, originalProductId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: SubstitutionStatus.PROPOSED },
  },
);

/**
 * Structural invariants. `invalidate` so they surface as a 400 naming the field
 * rather than an opaque 500.
 */
SubstitutionSchema.pre('validate', function (next) {
  if (this.originalProductId.equals(this.replacementProductId)) {
    this.invalidate('replacementProductId', 'A product cannot be substituted for itself');
  }

  // The price rule, enforced at the persistence layer so no write path can
  // produce a record that would charge the shopper more than they agreed to.
  const originalLineTotal = this.chargedUnitPrice * this.originalQuantity;
  const replacementLineTotal = this.replacementUnitPrice * this.replacementQuantity;

  if (replacementLineTotal > originalLineTotal) {
    this.invalidate(
      'replacementUnitPrice',
      'A replacement may not cost more than the line it replaces',
    );
  }

  return next();
});

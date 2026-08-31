import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { DEFAULT_CURRENCY, PaymentMethod, PaymentStatus } from '../enums';

export type PaymentDocument = HydratedDocument<Payment>;

export const PAYMENT_COLLECTION = 'payments';

/**
 * The money record for an order.
 *
 * Deliberately its own collection rather than a sub-document, even though today
 * every order has exactly one payment and that payment is always cash. The
 * moment a card gateway arrives there are retries, partial captures and refunds
 * — several payment attempts against one order — and that is a collection, not
 * a field. Building it as one now costs a join the order view does not even
 * need (the order carries its own payment summary) and saves a migration later.
 *
 * NOTHING SENSITIVE IS STORED HERE. No card numbers, no CVVs, no tokens that
 * could authorise a charge. `providerReference` is an opaque id issued by a
 * gateway for reconciliation, and it is absent for cash orders because cash has
 * nothing to reconcile against.
 */
@Schema({
  timestamps: true,
  collection: PAYMENT_COLLECTION,
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
export class Payment {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  /** Denormalised so payment reconciliation never has to join back to orders. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: Object.values(PaymentMethod) })
  method: PaymentMethod;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  /** Whole PKR — the order total at the moment the order was placed. */
  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  @Prop({ type: String, required: true, default: DEFAULT_CURRENCY, uppercase: true, maxlength: 3 })
  currency: string;

  /**
   * Which integration handled this. "cash" for COD — not null, so a report can
   * group by provider without special-casing the absence of one.
   */
  @Prop({ type: String, required: true, trim: true, maxlength: 40, default: 'cash' })
  provider: string;

  /** Opaque gateway reference. Never present for cash. */
  @Prop({ type: String, trim: true, maxlength: 120, default: null })
  providerReference: string | null;

  /** Set once, when the money actually arrives. */
  @Prop({ type: Date, default: null })
  paidAt: Date | null;

  @Prop({ type: String, trim: true, maxlength: 300, default: null })
  failureReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// --- Indexes -------------------------------------------------------------

// One payment per order today; the unique index states that intent and blocks a
// duplicate record if order creation is ever retried after a partial failure.
// It is dropped to non-unique on the day multiple attempts per order are real.
PaymentSchema.index({ orderId: 1 }, { unique: true });

// Reconciliation: "which cash payments are still outstanding?".
PaymentSchema.index({ status: 1, createdAt: -1 });

// A shopper's payment history, should a receipts screen need it.
PaymentSchema.index({ userId: 1, createdAt: -1 });

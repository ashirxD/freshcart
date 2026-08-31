import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type InventoryAdjustmentDocument = HydratedDocument<InventoryAdjustment>;

export const INVENTORY_ADJUSTMENT_COLLECTION = 'inventory_adjustments';

/**
 * Why a stock level changed. A short controlled list, because free text in this
 * field would make the record unqueryable — and the point of keeping it is to be
 * able to ask "how much did we write off as damaged last month?".
 */
export enum StockChangeReason {
  RESTOCK = 'RESTOCK',
  CORRECTION = 'CORRECTION',
  DAMAGED = 'DAMAGED',
  EXPIRED = 'EXPIRED',
  /** Taken by an order. Written by the fulfilment path, not by a human. */
  ORDER = 'ORDER',
  OTHER = 'OTHER',
}

/**
 * A single stock movement, recorded after the fact.
 *
 * This is deliberately NOT a ledger. The `Inventory` document remains the
 * authority on how much stock exists — nothing is ever derived by replaying
 * these rows. That distinction is what keeps the write path a single atomic
 * guarded update (see `InventoryService.tryReserve`) instead of an
 * append-and-recompute scheme that would need locking to stay correct.
 *
 * What it buys operationally: "who set this to 4, and when, and why?" — the
 * question a manager actually asks when a count looks wrong. §34 asks for
 * exactly that and explicitly warns against building enterprise inventory
 * accounting, so the row is five facts and nothing more.
 *
 * Recorded only for *human* adjustments. Order reservations and releases are
 * high-frequency and already reconstructible from the order's own history, so
 * writing a row per basket line would add cost to the hot checkout path for
 * information that is already available elsewhere.
 */
@Schema({
  timestamps: { createdAt: 'changedAt', updatedAt: false },
  collection: INVENTORY_ADJUSTMENT_COLLECTION,
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
export class InventoryAdjustment {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Store', required: true })
  storeId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  previousQuantity: number;

  @Prop({ type: Number, required: true, min: 0 })
  newQuantity: number;

  /** newQuantity − previousQuantity. Stored so "all write-offs" is one query. */
  @Prop({ type: Number, required: true })
  delta: number;

  @Prop({ type: String, required: true, enum: Object.values(StockChangeReason) })
  reason: StockChangeReason;

  /** Optional operator note, e.g. "delivery 40 crates". Never customer data. */
  @Prop({ type: String, default: null, maxlength: 200 })
  note: string | null;

  /**
   * Who did it, from the verified JWT principal.
   *
   * Never accepted from a request body — an audit trail a client can author is
   * not an audit trail.
   */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  changedByUserId: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 20 })
  changedByRole: string;

  changedAt: Date;
}

export const InventoryAdjustmentSchema = SchemaFactory.createForClass(InventoryAdjustment);

// "What changed in this store recently?" — the only listing this collection has.
InventoryAdjustmentSchema.index({ storeId: 1, changedAt: -1 });

// "What happened to this product?" — the per-product history on a stock row.
InventoryAdjustmentSchema.index({ productId: 1, changedAt: -1 });

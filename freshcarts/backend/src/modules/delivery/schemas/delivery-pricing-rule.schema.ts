import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type DeliveryPricingRuleDocument = HydratedDocument<DeliveryPricingRule>;

export const DELIVERY_PRICING_RULE_COLLECTION = 'delivery_pricing_rules';

/** A single delivery fee cannot plausibly exceed this. Guards typos in admin input. */
export const MAX_DELIVERY_FEE_PKR = 5_000;

/**
 * One distance band and the fee charged inside it.
 *
 * BAND SEMANTICS — half-open, [minDistanceMeters, maxDistanceMeters)
 *
 * The lower bound is inclusive and the upper bound exclusive. That is the only
 * choice that makes adjacent bands unambiguous: with 0–2 km and 2–5 km written
 * as [0, 2000) and [2000, 5000), a distance of exactly 2000 m belongs to
 * exactly one band, with no gap and no overlap. Inclusive-inclusive bounds
 * would make 2000 m match both, and the fee would depend on evaluation order.
 *
 * Stored in the database rather than in code so an admin can retune pricing
 * later without a deploy — the reason the engine reads rules instead of running
 * a chain of `if` statements.
 */
@Schema({
  timestamps: true,
  collection: DELIVERY_PRICING_RULE_COLLECTION,
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
export class DeliveryPricingRule {
  /** Per-store, because a second store will price its own deliveries. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Store', required: true })
  storeId: Types.ObjectId;

  /** Shown to staff, never to shoppers: "Nearby", "Across town". */
  @Prop({ type: String, required: true, trim: true, maxlength: 60 })
  label: string;

  /** Inclusive lower bound, metres. */
  @Prop({ type: Number, required: true, min: 0, max: 1_000_000 })
  minDistanceMeters: number;

  /** Exclusive upper bound, metres. */
  @Prop({ type: Number, required: true, min: 1, max: 1_000_000 })
  maxDistanceMeters: number;

  /** Whole PKR, like every other amount in the system. */
  @Prop({ type: Number, required: true, min: 0, max: MAX_DELIVERY_FEE_PKR })
  fee: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  /**
   * Tie-break when two active bands overlap. Higher wins.
   *
   * Overlaps are a configuration mistake — `validateRuleSet` reports them — but
   * the engine must still be deterministic if one reaches production, because
   * "whichever the database returned first" is not a pricing policy.
   */
  @Prop({ type: Number, default: 0, min: -1000, max: 1000 })
  priority: number;

  createdAt: Date;
  updatedAt: Date;
}

export const DeliveryPricingRuleSchema = SchemaFactory.createForClass(DeliveryPricingRule);

// The only query the engine issues: active bands for a store, in resolution order.
DeliveryPricingRuleSchema.index({ storeId: 1, isActive: 1, priority: -1, minDistanceMeters: 1 });

/** An empty or inverted band would silently price nothing, or everything. */
DeliveryPricingRuleSchema.pre('validate', function (next) {
  if (this.maxDistanceMeters <= this.minDistanceMeters) {
    this.invalidate(
      'maxDistanceMeters',
      'maxDistanceMeters must be greater than minDistanceMeters, otherwise the band is empty',
    );
  }

  return next();
});

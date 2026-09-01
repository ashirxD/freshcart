import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PK_MOBILE_E164 } from 'src/common/utils';

export type PlatformSettingsDocument = HydratedDocument<PlatformSettings>;

export const PLATFORM_SETTINGS_COLLECTION = 'platform_settings';

/**
 * The singleton key. Business settings are one document, not a key/value table:
 * every read wants all of them, they are typed and validated as a set, and a
 * generic bag would put schema enforcement back in application code.
 */
export const PLATFORM_SETTINGS_KEY = 'platform';

/**
 * BUSINESS CONFIGURATION — the values an operator changes, not a deployer.
 *
 * §25 draws the line this document sits on. Environment configuration answers
 * "where does this process find its dependencies?" — MONGODB_URI, JWT_SECRET,
 * AI_SERVICE_URL — and lives in `configuration.ts`. Business configuration
 * answers "how does FreshCarts trade?" and belongs here, because changing it
 * must not require a deploy and must be attributable to an admin.
 *
 * Every field below is read by real code. Nothing is stored speculatively: a
 * setting nobody consults is a lie about how the system behaves.
 */
@Schema({
  timestamps: true,
  collection: PLATFORM_SETTINGS_COLLECTION,
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
export class PlatformSettings {
  /** Always {@link PLATFORM_SETTINGS_KEY}. Unique, so a second row cannot exist. */
  @Prop({ type: String, required: true, unique: true, default: PLATFORM_SETTINGS_KEY })
  key: string;

  /**
   * The service radius. Read by DeliveryService on every quote, so an admin
   * lowering it takes effect on the next checkout — and historical orders keep
   * the distance and fee they were placed with.
   */
  @Prop({ type: Number, required: true, min: 500, max: 100_000, default: 12_000 })
  maxDeliveryDistanceMeters: number;

  /**
   * Applied to inventory rows created without an explicit threshold. Existing
   * rows keep the threshold they already have — this is a default, not a
   * retroactive rewrite of every product's low-stock line.
   */
  @Prop({ type: Number, required: true, min: 0, max: 10_000, default: 5 })
  defaultLowStockThreshold: number;

  /**
   * A platform-wide pause, distinct from a store being closed or deactivated.
   * Checkout refuses while this is false, so an operator can stop the queue
   * during an incident without editing store hours.
   */
  @Prop({ type: Boolean, required: true, default: true })
  orderingEnabled: boolean;

  /** Shown to shoppers on error and order screens. Never a personal number. */
  @Prop({
    type: String,
    required: true,
    trim: true,
    default: '+923000000000',
    match: [PK_MOBILE_E164, 'Support phone must be a valid Pakistani mobile number'],
  })
  supportPhone: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 160,
    default: 'support@freshcarts.pk',
  })
  supportEmail: string;

  createdAt: Date;
  updatedAt: Date;
}

export const PlatformSettingsSchema = SchemaFactory.createForClass(PlatformSettings);

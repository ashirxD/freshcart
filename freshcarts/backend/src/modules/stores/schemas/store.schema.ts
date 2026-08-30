import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PK_MOBILE_E164 } from 'src/common/utils';

export type StoreDocument = HydratedDocument<Store>;

export const STORE_COLLECTION = 'stores';

/** Day index matching JavaScript's `Date#getDay()` — 0 is Sunday. */
export const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

/** 24-hour local time, e.g. "08:00" or "23:30". */
export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

@Schema({ _id: false })
export class OpeningHours {
  @Prop({ type: Number, required: true, min: 0, max: 6 })
  day: DayOfWeek;

  @Prop({ type: String, required: true, match: TIME_OF_DAY_PATTERN })
  opensAt: string;

  @Prop({ type: String, required: true, match: TIME_OF_DAY_PATTERN })
  closesAt: string;

  @Prop({ type: Boolean, default: false })
  isClosed: boolean;
}

const OpeningHoursSchema = SchemaFactory.createForClass(OpeningHours);

@Schema({ _id: false })
export class StoreAddress {
  @Prop({ type: String, required: true, trim: true, maxlength: 160 })
  line1: string;

  @Prop({ type: String, trim: true, maxlength: 160 })
  line2?: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 80 })
  area: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 80 })
  city: string;

  @Prop({ type: String, trim: true, maxlength: 80 })
  province?: string;

  @Prop({ type: String, trim: true, maxlength: 12 })
  postalCode?: string;

  @Prop({ type: String, default: 'PK', maxlength: 2, uppercase: true })
  country: string;
}

const StoreAddressSchema = SchemaFactory.createForClass(StoreAddress);

/**
 * GeoJSON Point, stored in the shape MongoDB's `2dsphere` index expects
 * (`[longitude, latitude]` — that order, not the human one).
 *
 * Delivery-radius logic belongs to a later milestone; persisting the coordinate
 * correctly now means that work is a query away instead of a migration away.
 */
@Schema({ _id: false })
export class GeoPoint {
  @Prop({ type: String, enum: ['Point'], default: 'Point' })
  type: 'Point';

  @Prop({ type: [Number], required: true })
  coordinates: [number, number];
}

const GeoPointSchema = SchemaFactory.createForClass(GeoPoint);

/**
 * A physical grocery store and the catalogue scope every product, category and
 * cart hangs off.
 *
 * The platform currently runs one store. Everything downstream is nonetheless
 * keyed by `storeId` so adding a second store is data entry, not a rewrite —
 * but no multi-store routing, inventory transfer or fulfilment logic is built
 * before there is a second store to justify it.
 */
@Schema({
  timestamps: true,
  collection: STORE_COLLECTION,
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
export class Store {
  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 120 })
  name: string;

  @Prop({ type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 })
  slug: string;

  @Prop({ type: String, trim: true, maxlength: 600 })
  description?: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  logoUrl?: string;

  @Prop({ type: StoreAddressSchema, required: true })
  address: StoreAddress;

  @Prop({ type: GeoPointSchema, required: true })
  location: GeoPoint;

  @Prop({
    type: String,
    required: true,
    trim: true,
    match: [PK_MOBILE_E164, 'Store phone must be a valid Pakistani mobile number'],
  })
  phone: string;

  @Prop({ type: String, lowercase: true, trim: true, maxlength: 160 })
  email?: string;

  @Prop({ type: [OpeningHoursSchema], default: [] })
  openingHours: OpeningHours[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const StoreSchema = SchemaFactory.createForClass(Store);

// The customer catalogue always resolves "the active store" — this is that query.
StoreSchema.index({ isActive: 1, createdAt: 1 });

// Reserved for delivery-radius work; a 2dsphere index is the only way to make
// "stores near this address" answerable without a collection scan.
StoreSchema.index({ location: '2dsphere' });

/**
 * A store may not advertise a closing time that precedes its opening time.
 *
 * Reported with `invalidate` rather than `next(new Error(...))`: that produces a
 * real Mongoose ValidationError, which the exception filter renders as a 400
 * naming the offending field. A bare Error reaches the client as an opaque 500.
 */
StoreSchema.pre('validate', function (next) {
  for (const [index, window] of (this.openingHours ?? []).entries()) {
    if (!window.isClosed && window.closesAt <= window.opensAt) {
      this.invalidate(
        'openingHours.' + index + '.closesAt',
        'Opening hours for day ' + window.day + ' must close after they open',
      );
    }
  }

  return next();
});

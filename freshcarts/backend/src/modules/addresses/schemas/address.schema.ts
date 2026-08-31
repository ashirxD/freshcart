import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { PK_MOBILE_E164 } from 'src/common/utils';

export type AddressDocument = HydratedDocument<Address>;

export const ADDRESS_COLLECTION = 'addresses';

/** Keeps a shopper's address book navigable, and bounds the ownership queries. */
export const MAX_ADDRESSES_PER_USER = 15;

/**
 * How a shopper recognises one of their own addresses at a glance.
 * A free-text `label` would produce fifteen variants of "home"; three fixed
 * kinds plus an optional nickname gives sortable, iconifiable data.
 */
export enum AddressLabel {
  HOME = 'HOME',
  WORK = 'WORK',
  OTHER = 'OTHER',
}

/**
 * A saved delivery address belonging to exactly one customer.
 *
 * Two decisions worth stating:
 *
 * 1. Coordinates are optional. A shopper can save an address by typing it, and
 *    a great many Pakistani addresses are landmark-based with no clean
 *    geocode. Delivery then refuses that address with a specific, fixable error
 *    rather than the address being unsaveable in the first place.
 *
 * 2. This document is never referenced by a historical order. Orders embed an
 *    address snapshot, because a shopper editing "Home" next month must not
 *    rewrite where last month's order went.
 */
@Schema({
  timestamps: true,
  collection: ADDRESS_COLLECTION,
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
export class Address {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(AddressLabel), default: AddressLabel.HOME })
  label: AddressLabel;

  /** Optional nickname shown beside the label: "Ammi's house", "Warehouse". */
  @Prop({ type: String, trim: true, maxlength: 60 })
  nickname?: string;

  /** Who the rider asks for. Not necessarily the account holder. */
  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 80 })
  recipientName: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    match: [PK_MOBILE_E164, 'Phone must be a valid Pakistani mobile number'],
  })
  phone: string;

  /** House / shop / flat number. */
  @Prop({ type: String, required: true, trim: true, maxlength: 60 })
  houseNumber: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  street: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 100 })
  area: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 80 })
  city: string;

  /**
   * "Opposite Al-Fatah, near the mosque". In Pakistan this is frequently the
   * only reliable way a rider finds the door, so it is a first-class field.
   */
  @Prop({ type: String, trim: true, maxlength: 160 })
  landmark?: string;

  @Prop({ type: String, trim: true, maxlength: 300 })
  deliveryInstructions?: string;

  /**
   * Stored as separate scalars rather than a GeoJSON point.
   *
   * Nothing queries addresses *by* location — the only consumer is the routing
   * call, which needs one pair of numbers. A 2dsphere index and a nested point
   * would be structure with no query behind it, and it could not express
   * "coordinates not set yet", which is a real state here.
   */
  @Prop({ type: Number, default: null, min: -90, max: 90 })
  latitude: number | null;

  @Prop({ type: Number, default: null, min: -180, max: 180 })
  longitude: number | null;

  @Prop({ type: Boolean, default: false })
  isDefault: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

// --- Indexes -------------------------------------------------------------

// The only listing query there is: this shopper's addresses, default first.
AddressSchema.index({ userId: 1, isDefault: -1, updatedAt: -1 });

/**
 * At most one default per shopper, enforced by the database rather than by
 * application discipline alone.
 *
 * A partial unique index on `{ userId, isDefault: true }` is what makes a
 * second default impossible even if two requests race — AddressesService still
 * clears the previous default first, but this index is what guarantees the
 * invariant when that clearing loses a race.
 */
AddressSchema.index(
  { userId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
);

/**
 * Coordinates come as a pair or not at all. Half a coordinate is not a location
 * and would send a routing request to (lat, 0) somewhere in the Atlantic.
 */
AddressSchema.pre('validate', function (next) {
  const hasLatitude = this.latitude !== null && this.latitude !== undefined;
  const hasLongitude = this.longitude !== null && this.longitude !== undefined;

  if (hasLatitude !== hasLongitude) {
    this.invalidate(
      hasLatitude ? 'longitude' : 'latitude',
      'Latitude and longitude must be provided together',
    );
  }

  return next();
});

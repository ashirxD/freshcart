import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type FavoriteDocument = HydratedDocument<Favorite>;

export const FAVORITE_COLLECTION = 'favorites';

/**
 * A shopper's saved product.
 *
 * A row per (user, product) rather than an array on the user document: the list
 * grows without bound over years, and "is this product favourited?" needs to be
 * an indexed point lookup on a product page, not a scan of an embedded array.
 */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: FAVORITE_COLLECTION,
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
export class Favorite {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  createdAt: Date;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

// Duplicate prevention is a database guarantee, not an application convention:
// a double-tap on the heart cannot create two rows whatever the service does.
FavoriteSchema.index({ userId: 1, productId: 1 }, { unique: true });

// "My favourites, newest first" — the list query.
FavoriteSchema.index({ userId: 1, createdAt: -1 });

// Cleanup when a product is deleted.
FavoriteSchema.index({ productId: 1 });

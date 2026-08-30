import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type InventoryDocument = HydratedDocument<Inventory>;

export const INVENTORY_COLLECTION = 'inventory';

/**
 * Stock for one product at one store.
 *
 * Kept out of the Product document deliberately: quantity changes on every sale
 * and restock, while the product record barely changes. Separating them keeps
 * hot stock writes off the catalogue document (and off its indexes), and it is
 * the shape multi-store needs — one product, one row of stock per store.
 *
 * Availability (IN_STOCK / LOW_STOCK / OUT_OF_STOCK) is intentionally NOT a
 * field. It is derived from `quantity` and `lowStockThreshold` by
 * `deriveStockStatus`, so it cannot go stale behind a quantity write.
 */
@Schema({
  timestamps: true,
  collection: INVENTORY_COLLECTION,
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
export class Inventory {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Store', required: true })
  storeId: Types.ObjectId;

  /** Units on hand. Never negative — enforced here and by the update paths. */
  @Prop({ type: Number, required: true, default: 0, min: 0, max: 1_000_000 })
  quantity: number;

  /** At or below this, the product reads as LOW_STOCK. */
  @Prop({ type: Number, required: true, default: 5, min: 0, max: 100_000 })
  lowStockThreshold: number;

  createdAt: Date;
  updatedAt: Date;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);

// One stock row per product per store. This unique index is what makes the
// upsert in InventoryService safe against two concurrent writers.
InventorySchema.index({ productId: 1, storeId: 1 }, { unique: true });

// Back-office "what is running out?" query, and the join key for catalogue reads.
InventorySchema.index({ storeId: 1, quantity: 1 });

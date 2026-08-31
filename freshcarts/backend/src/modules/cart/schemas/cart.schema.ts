import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type CartDocument = HydratedDocument<Cart>;

export const CART_COLLECTION = 'carts';

/** Per-line cap, so a mis-tap or a script cannot request 10,000 bottles of milk. */
export const MAX_CART_ITEM_QUANTITY = 99;

/** Distinct products per cart. Generous for a grocery basket, still bounded. */
export const MAX_CART_ITEMS = 100;

/**
 * A line in the cart.
 *
 * It stores a product reference, a quantity, and the price the shopper was
 * shown when they added it — nothing else. No name, no image: those are re-read
 * from the catalogue whenever the cart is served, so a stale copy can never be
 * displayed. The client cannot submit any of it; there is nowhere for it to land.
 */
@Schema({ _id: false, timestamps: { createdAt: 'addedAt', updatedAt: false } })
export class CartItem {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: MAX_CART_ITEM_QUANTITY })
  quantity: number;

  /**
   * The unit price at the moment this line was added or last changed.
   *
   * FOR CHANGE DETECTION ONLY. Nothing prices, charges or displays from this
   * field — the catalogue remains the sole authority for what anything costs,
   * and the cart subtotal is still computed from live prices on every read.
   *
   * It exists because "your milk went from Rs. 320 to Rs. 340" is impossible to
   * say without a record of what the shopper agreed to, and silently charging
   * the new price is precisely what must not happen. Checkout compares this
   * against the live price, refuses to proceed while they differ, and only
   * continues once the shopper has seen the change and accepted it.
   *
   * Null on lines added before this field existed: unknown, so no claim is made.
   */
  @Prop({ type: Number, default: null, min: 0 })
  unitPriceSnapshot: number | null;

  addedAt: Date;
}

const CartItemSchema = SchemaFactory.createForClass(CartItem);

/**
 * One cart per customer per store.
 *
 * Embedding items rather than giving them their own collection is deliberate:
 * a cart is always read and written whole, is bounded in size, and belongs to
 * exactly one owner — which also makes "only touch your own cart" a single
 * `userId` match rather than a per-row ownership check.
 */
@Schema({
  timestamps: true,
  collection: CART_COLLECTION,
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
export class Cart {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Store', required: true })
  storeId: Types.ObjectId;

  @Prop({ type: [CartItemSchema], default: [] })
  items: CartItem[];

  createdAt: Date;
  updatedAt: Date;
}

export const CartSchema = SchemaFactory.createForClass(Cart);

// One cart per shopper per store; also the lookup for every cart request.
CartSchema.index({ userId: 1, storeId: 1 }, { unique: true });

// Supports the "is this product in anyone's cart?" guard on product deletion.
CartSchema.index({ 'items.productId': 1 });

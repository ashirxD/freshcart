import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { DISCRETE_UNIT_TYPES, UnitType } from 'src/common/enums';

export type ProductDocument = HydratedDocument<Product>;

export const PRODUCT_COLLECTION = 'products';

/**
 * MONEY REPRESENTATION
 *
 * Prices are whole Pakistani rupees, stored as integers.
 *
 * Grocery pricing in Pakistan does not use paisa — shelf prices are Rs. 340, not
 * Rs. 340.75 — so rupees *are* the smallest unit this catalogue needs. Using an
 * integer keeps every arithmetic operation exact: cart subtotals, discounts and
 * later order totals are additions of integers, never IEEE-754 floats that drift
 * a rupee over a large basket.
 *
 * If sub-rupee pricing is ever required, the migration is a scale change to
 * paisa in one place, not a hunt for float bugs across the codebase.
 */
export const MAX_PRICE_PKR = 10_000_000;

@Schema({ _id: false })
export class ProductImage {
  @Prop({ type: String, required: true, trim: true, maxlength: 600 })
  url: string;

  /** Required, because a product image with no alt text is unusable to a screen reader. */
  @Prop({ type: String, required: true, trim: true, maxlength: 160 })
  alt: string;

  @Prop({ type: Number, default: 0, min: 0, max: 99 })
  sortOrder: number;
}

const ProductImageSchema = SchemaFactory.createForClass(ProductImage);

@Schema({
  timestamps: true,
  collection: PRODUCT_COLLECTION,
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
export class Product {
  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 160 })
  name: string;

  /** Derived server-side from `name`. Unique per store; the public URL segment. */
  @Prop({ type: String, required: true, trim: true, lowercase: true, maxlength: 180 })
  slug: string;

  @Prop({ type: String, trim: true, maxlength: 4000 })
  description?: string;

  /** One-line summary for cards and search results. */
  @Prop({ type: String, trim: true, maxlength: 200 })
  shortDescription?: string;

  @Prop({ type: String, trim: true, maxlength: 80, index: true })
  brand?: string;

  /** Always a top-level category. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;

  /** Optional child of `categoryId`. Enforced by CategoriesService on write. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Category', default: null })
  subcategoryId: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Store', required: true })
  storeId: Types.ObjectId;

  @Prop({ type: [ProductImageSchema], default: [] })
  images: ProductImage[];

  /** Whole PKR. See MAX_PRICE_PKR for why this is an integer. */
  @Prop({ type: Number, required: true, min: 1, max: MAX_PRICE_PKR })
  sellingPrice: number;

  /**
   * The "was" price. Present only when the product is genuinely discounted, and
   * validated to exceed `sellingPrice` so a struck-through price is never a lie.
   */
  @Prop({ type: Number, default: null, min: 1, max: MAX_PRICE_PKR })
  compareAtPrice: number | null;

  @Prop({ type: String, required: true, enum: Object.values(UnitType) })
  unitType: UnitType;

  /** Size in `unitType` units: 1 litre, 500 g, 5 kg, 1 dozen. */
  @Prop({ type: Number, required: true, min: 0.001, max: 100_000 })
  unitValue: number;

  /** Unique per store. Uppercased so lookups are case-insensitive by construction. */
  @Prop({ type: String, required: true, trim: true, uppercase: true, maxlength: 40 })
  sku: string;

  /**
   * EAN/UPC where the product has one. Many local grocery items do not, so this
   * is optional and only unique when present.
   */
  @Prop({ type: String, trim: true, maxlength: 32, default: undefined })
  barcode?: string;

  /**
   * Extra tokens the product should be findable by: Urdu and Roman-Urdu names
   * ("doodh", "atta"), common misspellings, brand aliases.
   *
   * This is the seam for richer search later — Urdu matching, OCR receipts,
   * voice input — without a schema migration. It is a plain array today, filled
   * by admins and the seeder; nothing here presumes a search engine.
   */
  @Prop({ type: [String], default: [], index: true })
  searchTerms: string[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isFeatured: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// --- Indexes -------------------------------------------------------------
// Chosen from the queries the application actually issues, not field by field.

// Public URL lookup, and the uniqueness guarantee behind it.
ProductSchema.index({ storeId: 1, slug: 1 }, { unique: true });

// SKU is the operational identifier: unique per store, used for admin lookup.
ProductSchema.index({ storeId: 1, sku: 1 }, { unique: true });

// Barcode scanning (store operations, later milestones). Unique only when set,
// so the majority of products that have no barcode do not collide on `null`.
ProductSchema.index(
  { storeId: 1, barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: 'string' } } },
);

// The default catalogue listing: active products of a store, newest first.
ProductSchema.index({ storeId: 1, isActive: 1, createdAt: -1 });

// Category and subcategory browse, which is the single most common filter.
ProductSchema.index({ storeId: 1, isActive: 1, categoryId: 1, createdAt: -1 });
ProductSchema.index({ storeId: 1, isActive: 1, subcategoryId: 1, createdAt: -1 });

// Price sorting and the min/max price filter.
ProductSchema.index({ storeId: 1, isActive: 1, sellingPrice: 1 });

// The home page's featured rail.
ProductSchema.index(
  { storeId: 1, isFeatured: 1, isActive: 1 },
  { partialFilterExpression: { isFeatured: true } },
);

/**
 * Catalogue invariants, enforced at the persistence layer so no write path —
 * API, seeder or script — can bypass them.
 *
 * Reported with `invalidate` rather than `next(new Error(...))`: that produces a
 * real Mongoose ValidationError, which the exception filter renders as a 400
 * naming the offending field. A bare Error reaches the client as an opaque 500.
 */
ProductSchema.pre('validate', function (next) {
  // A pack size that cannot exist in the real world: half a dozen eggs is a
  // count of six, not a `unitValue` of 0.5.
  if (DISCRETE_UNIT_TYPES.includes(this.unitType) && !Number.isInteger(this.unitValue)) {
    this.invalidate(
      'unitValue',
      'A ' + this.unitType.toLowerCase() + ' quantity must be a whole number',
    );
  }

  if (
    this.compareAtPrice !== null &&
    this.compareAtPrice !== undefined &&
    this.compareAtPrice <= this.sellingPrice
  ) {
    this.invalidate(
      'compareAtPrice',
      'compareAtPrice must be greater than sellingPrice, otherwise the discount is not real',
    );
  }

  return next();
});

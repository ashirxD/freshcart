import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

export const CATEGORY_COLLECTION = 'categories';

/**
 * How deep the tree may go. Two levels — "Dairy > Milk" — is what the shopping
 * UI models, and capping it here keeps breadcrumb, filter and navigation code
 * free of arbitrary-depth recursion it would never exercise.
 */
export const MAX_CATEGORY_DEPTH = 2;

/**
 * A catalogue category, optionally nested one level under a parent.
 *
 * `parentId === null` is a top-level category; a parent id makes it a
 * subcategory. Nothing in the frontend hardcodes category names — this
 * collection is the only source of them.
 */
@Schema({
  timestamps: true,
  collection: CATEGORY_COLLECTION,
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
export class Category {
  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 80 })
  name: string;

  /** Derived server-side from `name`; the client never supplies the final value. */
  @Prop({ type: String, required: true, trim: true, lowercase: true, maxlength: 100 })
  slug: string;

  @Prop({ type: String, trim: true, maxlength: 400 })
  description?: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  imageUrl?: string;

  /** Lucide icon name, so category tiles can render without an image asset. */
  @Prop({ type: String, trim: true, maxlength: 40 })
  icon?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Category', default: null, index: true })
  parentId: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Store', required: true })
  storeId: Types.ObjectId;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  /** Ascending. Controls the order categories appear in for customers. */
  @Prop({ type: Number, default: 0, min: 0, max: 9999 })
  displayOrder: number;

  createdAt: Date;
  updatedAt: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

// Slugs are the public URL segment, so they must be unique per store — not
// globally, which would stop a second store from having its own "dairy".
CategorySchema.index({ storeId: 1, slug: 1 }, { unique: true });

// The customer catalogue query: active categories for a store, in display order.
CategorySchema.index({ storeId: 1, isActive: 1, displayOrder: 1 });

// Subcategory fan-out for a category page.
CategorySchema.index({ storeId: 1, parentId: 1, displayOrder: 1 });

/**
 * Structural invariant enforced at the persistence layer: a category can never
 * be its own parent, whichever code path performs the write. Deeper cycles need
 * a database read and are checked in CategoriesService.
 */
CategorySchema.pre('validate', function (next) {
  if (this.parentId && this.parentId.equals(this._id)) {
    this.invalidate('parentId', 'A category cannot be its own parent');
  }
  return next();
});

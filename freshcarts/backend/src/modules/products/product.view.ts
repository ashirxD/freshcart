import { Types } from 'mongoose';
import { UNIT_ABBREVIATION, UnitType } from 'src/common/enums';
import type { StockView } from 'src/modules/inventory/inventory.service';
import { ProductImage } from './schemas';

/**
 * The product shape that crosses the API boundary.
 *
 * Everything a client needs to render a product is computed here — discount
 * percentage, pack-size label, primary image — so the browser never re-derives
 * a pricing rule and the web and any future app agree by construction.
 */
export interface ProductView {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  brand?: string;
  categoryId: string;
  subcategoryId: string | null;
  images: Array<{ url: string; alt: string; sortOrder: number }>;
  /** First image by sort order, pre-resolved for cards. */
  primaryImage: { url: string; alt: string } | null;
  sellingPrice: number;
  compareAtPrice: number | null;
  /** 0 when the product is not discounted. Server-computed, never trusted from a client. */
  discountPercent: number;
  unitType: UnitType;
  unitValue: number;
  /** Human pack size: "1 L", "500 g", "1 dozen". */
  unitLabel: string;
  sku: string;
  barcode?: string;
  isActive: boolean;
  isFeatured: boolean;
  stock: StockView;
  createdAt: Date;
}

/** Fields a full product page adds on top of the card shape. */
export interface ProductDetailView extends ProductView {
  description?: string;
  searchTerms: string[];
  category: { id: string; name: string; slug: string } | null;
  subcategory: { id: string; name: string; slug: string } | null;
  updatedAt: Date;
}

/** The lean product document shape the mappers accept. */
export interface LeanProduct {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  brand?: string;
  categoryId: Types.ObjectId;
  subcategoryId: Types.ObjectId | null;
  storeId: Types.ObjectId;
  images: ProductImage[];
  sellingPrice: number;
  compareAtPrice: number | null;
  unitType: UnitType;
  unitValue: number;
  sku: string;
  barcode?: string;
  searchTerms: string[];
  isActive: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The one definition of "how much off". Every surface — card badge, product
 * page, admin table — reads this number rather than dividing prices itself.
 */
export function discountPercent(sellingPrice: number, compareAtPrice: number | null): number {
  if (!compareAtPrice || compareAtPrice <= sellingPrice) return 0;
  return Math.round(((compareAtPrice - sellingPrice) / compareAtPrice) * 100);
}

/** Renders a pack size the way a shelf label would. */
export function formatUnitLabel(unitType: UnitType, unitValue: number): string {
  if (unitType === UnitType.PIECE) {
    return unitValue === 1 ? '1 pc' : unitValue + ' pcs';
  }

  // Trim a trailing ".0" so 1.5 kg stays 1.5 kg but 2.0 kg reads as 2 kg.
  const value = Number.isInteger(unitValue) ? String(unitValue) : String(unitValue);
  return value + ' ' + UNIT_ABBREVIATION[unitType];
}

function sortedImages(
  images: ProductImage[],
): Array<{ url: string; alt: string; sortOrder: number }> {
  return [...(images ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((image) => ({ url: image.url, alt: image.alt, sortOrder: image.sortOrder }));
}

export function toProductView(product: LeanProduct, stock: StockView): ProductView {
  const images = sortedImages(product.images);

  return {
    id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    brand: product.brand,
    categoryId: product.categoryId.toString(),
    subcategoryId: product.subcategoryId ? product.subcategoryId.toString() : null,
    images,
    primaryImage: images[0] ? { url: images[0].url, alt: images[0].alt } : null,
    sellingPrice: product.sellingPrice,
    compareAtPrice: product.compareAtPrice,
    discountPercent: discountPercent(product.sellingPrice, product.compareAtPrice),
    unitType: product.unitType,
    unitValue: product.unitValue,
    unitLabel: formatUnitLabel(product.unitType, product.unitValue),
    sku: product.sku,
    barcode: product.barcode,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    stock,
    createdAt: product.createdAt,
  };
}

export function toProductDetailView(
  product: LeanProduct,
  stock: StockView,
  category: { _id: Types.ObjectId; name: string; slug: string } | null,
  subcategory: { _id: Types.ObjectId; name: string; slug: string } | null,
): ProductDetailView {
  return {
    ...toProductView(product, stock),
    description: product.description,
    searchTerms: product.searchTerms ?? [],
    category: category
      ? { id: category._id.toString(), name: category.name, slug: category.slug }
      : null,
    subcategory: subcategory
      ? { id: subcategory._id.toString(), name: subcategory.name, slug: subcategory.slug }
      : null,
    updatedAt: product.updatedAt,
  };
}

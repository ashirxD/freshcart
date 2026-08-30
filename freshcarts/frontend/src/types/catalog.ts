/**
 * Mirrors of the API response shapes.
 *
 * These are read-only contracts: every value below is computed by the backend
 * (discount percentage, unit label, availability) so the browser never
 * re-derives a pricing or stock rule and the two can never disagree.
 */

/** The envelope every collection endpoint returns. */
export interface Paginated<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface Stock {
  quantity: number;
  lowStockThreshold: number;
  status: StockStatus;
  isAvailable: boolean;
}

export type UnitType = 'PIECE' | 'PACK' | 'KG' | 'G' | 'LITER' | 'ML' | 'DOZEN' | 'BOX' | 'BOTTLE';

export interface ProductImage {
  url: string;
  alt: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  brand?: string;
  categoryId: string;
  subcategoryId: string | null;
  images: ProductImage[];
  primaryImage: { url: string; alt: string } | null;
  /** Whole rupees. */
  sellingPrice: number;
  compareAtPrice: number | null;
  discountPercent: number;
  unitType: UnitType;
  unitValue: number;
  /** Ready-to-render pack size, e.g. "1 L" or "500 g". */
  unitLabel: string;
  sku: string;
  barcode?: string;
  isActive: boolean;
  isFeatured: boolean;
  stock: Stock;
  createdAt: string;
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface ProductDetail extends Product {
  description?: string;
  searchTerms: string[];
  category: CategoryRef | null;
  subcategory: CategoryRef | null;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  /** A lucide icon name, resolved by CategoryIcon. */
  icon?: string;
  parentId: string | null;
  isActive: boolean;
  displayOrder: number;
  /** Present only when the request asked for counts. */
  productCount?: number;
  children: Category[];
}

export interface CategoryDetail extends Category {
  /** Root-first path to this category, for breadcrumbs. */
  ancestors: CategoryRef[];
}

/** Sort options the API supports. "Popular" is absent until order data exists. */
export type ProductSort =
  'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'discount' | 'name_asc';

export interface ProductQuery {
  search?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  discounted?: boolean;
  featured?: boolean;
  sort?: ProductSort;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
}

export interface StoreAddress {
  line1: string;
  line2?: string;
  area: string;
  city: string;
  province?: string;
  postalCode?: string;
  country: string;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  address: StoreAddress;
  phone: string;
  email?: string;
  isActive: boolean;
}

/** What PATCH /inventory/:productId answers with: the new derived stock state. */
export interface StockUpdateResult extends Stock {
  productId: string;
}

export interface InventoryRow {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  imageUrl?: string;
  isProductActive: boolean;
  quantity: number;
  lowStockThreshold: number;
  status: StockStatus;
  isAvailable: boolean;
  updatedAt: string;
}

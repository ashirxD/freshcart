import type { Product } from './catalog';

/** Why a cart line cannot be bought right now. */
export type CartItemIssue = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'QUANTITY_REDUCED';

export interface CartItem {
  productId: string;
  quantity: number;
  /** Server-computed. Zero for any line carrying an issue. */
  lineTotal: number;
  addedAt: string;
  /** Null when the product has been removed from the catalogue entirely. */
  product: Product | null;
  issue: CartItemIssue | null;
  /** Stock ceiling for this line — what the "+" control must not exceed. */
  maxQuantity: number;
}

export interface Cart {
  id: string | null;
  items: CartItem[];
  /** Distinct products. */
  itemCount: number;
  /** Total units, which is what the navigation badge shows. */
  totalQuantity: number;
  /** Authoritative, computed by the API from catalogue prices. */
  subtotal: number;
  hasIssues: boolean;
  updatedAt: string | null;
}

export interface Favorite {
  productId: string;
  addedAt: string;
  product: Product | null;
}

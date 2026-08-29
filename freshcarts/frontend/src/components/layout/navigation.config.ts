import { Grid3x3, Home, Receipt, Search, ShoppingCart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Marks the cart entry so a badge can be attached without hardcoding a route. */
  showsCartCount?: boolean;
}

/**
 * One list drives both the mobile tab bar and the desktop header, so the two
 * navigations can never drift apart.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/categories', label: 'Categories', icon: Grid3x3 },
  { href: '/cart', label: 'Cart', icon: ShoppingCart, showsCartCount: true },
  { href: '/orders', label: 'Orders', icon: Receipt },
];

/** Treats nested routes as "inside" their section without matching everything on "/". */
export function isActiveRoute(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

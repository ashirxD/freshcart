import {
  Grid3x3,
  Heart,
  Home,
  MapPin,
  Receipt,
  ScanLine,
  Search,
  ShoppingCart,
} from 'lucide-react';
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
 *
 * Five tabs is the mobile ceiling — beyond that the targets stop being
 * comfortably thumb-sized. Saved items therefore lives in the desktop header
 * and is reached from the heart on any product on a phone.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/categories', label: 'Categories', icon: Grid3x3 },
  { href: '/cart', label: 'Cart', icon: ShoppingCart, showsCartCount: true },
  { href: '/orders', label: 'Orders', icon: Receipt },
];

/**
 * Shown on desktop, where there is room beyond the five primary tabs.
 *
 * Addresses live here rather than in the tab bar: a shopper manages them
 * occasionally, and checkout already offers "add a new address" at the moment
 * they actually need one.
 */
export const SECONDARY_NAV: NavItem[] = [
  { href: '/scan', label: 'Scan list', icon: ScanLine },
  { href: '/favorites', label: 'Saved', icon: Heart },
  { href: '/addresses', label: 'Addresses', icon: MapPin },
];

/** Treats nested routes as "inside" their section without matching everything on "/". */
export function isActiveRoute(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

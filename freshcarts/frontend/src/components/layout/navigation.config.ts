import {
  Grid3x3,
  Heart,
  Home,
  MapPin,
  Receipt,
  ScanLine,
  Search,
  ShoppingBasket,
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
 * NAVIGATION MODEL
 *
 * Mobile and desktop are two different compositions of the same destinations,
 * rather than one list squeezed into two shapes — which is what made the old
 * header read as an admin tool and the old tab bar spend a slot on search.
 *
 * MOBILE (§51): five tabs, the ceiling for comfortably thumb-sized targets.
 * Search is not one of them: it lives in the sticky header on every screen, so
 * it is always one tap away and the freed slot goes to Saved items, which had
 * no route on a phone at all before.
 */
export const MOBILE_NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/categories', label: 'Aisles', icon: Grid3x3 },
  { href: '/cart', label: 'Basket', icon: ShoppingBasket, showsCartCount: true },
  { href: '/orders', label: 'Orders', icon: Receipt },
  { href: '/favorites', label: 'Saved', icon: Heart },
];

/**
 * DESKTOP (§12): three shopping destinations in the centre, because search,
 * cart, saved items and the account all have their own dedicated affordance in
 * the header and should not compete for link space.
 */
export const DESKTOP_NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/categories', label: 'Categories', icon: Grid3x3 },
  { href: '/orders', label: 'Orders', icon: Receipt },
];

/**
 * The account menu's contents.
 *
 * Everything a shopper manages occasionally rather than while shopping. This
 * replaced a header link to `/account` — a route that does not exist — so the
 * menu is also the fix for a dead end in the old navigation.
 */
export const ACCOUNT_NAV: NavItem[] = [
  { href: '/orders', label: 'Your orders', icon: Receipt },
  { href: '/favorites', label: 'Saved items', icon: Heart },
  { href: '/addresses', label: 'Delivery addresses', icon: MapPin },
  { href: '/scan', label: 'Scan a grocery list', icon: ScanLine },
];

/** Header affordances that are icons rather than links with labels. */
export const HEADER_ACTIONS: NavItem[] = [
  { href: '/scan', label: 'Scan a grocery list', icon: ScanLine },
  { href: '/favorites', label: 'Saved items', icon: Heart },
];

export const SEARCH_NAV: NavItem = { href: '/search', label: 'Search', icon: Search };

/** Treats nested routes as "inside" their section without matching everything on "/". */
export function isActiveRoute(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

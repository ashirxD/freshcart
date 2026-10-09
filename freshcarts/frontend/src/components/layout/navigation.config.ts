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
import type { TranslationKey } from '@/i18n';

export interface NavItem {
  href: string;
  /** A translation key, not prose: the label is chosen when it is rendered. */
  labelKey: TranslationKey;
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
  { href: '/', labelKey: 'nav.home', icon: Home },
  { href: '/categories', labelKey: 'nav.aisles', icon: Grid3x3 },
  { href: '/cart', labelKey: 'nav.basket', icon: ShoppingBasket, showsCartCount: true },
  { href: '/orders', labelKey: 'nav.orders', icon: Receipt },
  { href: '/favorites', labelKey: 'nav.saved', icon: Heart },
];

/**
 * DESKTOP (§12): three shopping destinations in the centre, because search,
 * cart, saved items and the account all have their own dedicated affordance in
 * the header and should not compete for link space.
 */
export const DESKTOP_NAV: NavItem[] = [
  { href: '/', labelKey: 'nav.home', icon: Home },
  { href: '/categories', labelKey: 'nav.categories', icon: Grid3x3 },
  { href: '/orders', labelKey: 'nav.orders', icon: Receipt },
];

/**
 * The account menu's contents.
 *
 * Everything a shopper manages occasionally rather than while shopping. This
 * replaced a header link to `/account` — a route that does not exist — so the
 * menu is also the fix for a dead end in the old navigation.
 */
export const ACCOUNT_NAV: NavItem[] = [
  { href: '/orders', labelKey: 'nav.yourOrders', icon: Receipt },
  { href: '/favorites', labelKey: 'nav.savedItems', icon: Heart },
  { href: '/addresses', labelKey: 'nav.deliveryAddresses', icon: MapPin },
  { href: '/scan', labelKey: 'nav.scanList', icon: ScanLine },
];

/** Header affordances that are icons rather than links with labels. */
export const HEADER_ACTIONS: NavItem[] = [
  { href: '/scan', labelKey: 'nav.scanList', icon: ScanLine },
  { href: '/favorites', labelKey: 'nav.savedItems', icon: Heart },
];

export const SEARCH_NAV: NavItem = { href: '/search', labelKey: 'nav.search', icon: Search };

/** Treats nested routes as "inside" their section without matching everything on "/". */
export function isActiveRoute(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

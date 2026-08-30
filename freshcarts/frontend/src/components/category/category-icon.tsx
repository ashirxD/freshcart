import {
  Apple,
  Baby,
  Beef,
  CakeSlice,
  Candy,
  Carrot,
  Cookie,
  CupSoda,
  Croissant,
  Drumstick,
  Egg,
  Fish,
  IceCreamCone,
  Leaf,
  Milk,
  PawPrint,
  Popcorn,
  Refrigerator,
  Salad,
  ShoppingBasket,
  Snowflake,
  Soup,
  Sparkles,
  SprayCan,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * The icons a category may be given, as an explicit map.
 *
 * Deliberately not `import * as LucideIcons` with a dynamic lookup. That would
 * pull the entire icon set — well over a thousand components — into the client
 * bundle of every page that renders a category tile, on an app built for
 * mobile connections. It also would not work: lucide icons are `forwardRef`
 * objects, so a `typeof candidate === 'function'` check silently fails and
 * every category falls back to the default.
 *
 * The trade is that an admin picks from this list rather than any icon in the
 * library. Adding one is a single line here.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Apple,
  Baby,
  Beef,
  CakeSlice,
  Candy,
  Carrot,
  Cookie,
  Croissant,
  CupSoda,
  Drumstick,
  Egg,
  Fish,
  IceCreamCone,
  Leaf,
  Milk,
  PawPrint,
  Popcorn,
  Refrigerator,
  Salad,
  ShoppingBasket,
  Snowflake,
  Soup,
  Sparkles,
  SprayCan,
  Wheat,
};

/** The names an admin can choose from, for the category form's hint. */
export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS).sort();

export interface CategoryIconProps {
  /** The icon name stored on the category. Unknown names fall back safely. */
  name: string | undefined;
  className?: string;
}

/**
 * The icon name is data an admin types, so an unknown or removed name must
 * degrade to a sensible default rather than break the page.
 */
export function CategoryIcon({ name, className }: CategoryIconProps) {
  const Icon = (name && CATEGORY_ICONS[name]) || ShoppingBasket;
  return <Icon className={cn('size-6', className)} aria-hidden="true" />;
}

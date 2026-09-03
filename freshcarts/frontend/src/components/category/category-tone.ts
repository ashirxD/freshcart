/**
 * CATEGORY IDENTITIES
 *
 * A grocery aisle has a colour in a shopper's head — produce is green, bakery
 * is warm, the drinks fridge is cool — and giving the tiles those tones makes
 * the category row scannable at a glance instead of a wall of identical white
 * rectangles (§20).
 *
 * Three rules keep this from becoming a rainbow:
 *   1. Every tone is a WASH, not a fill: a tint of one palette colour on the
 *      warm page, with its own deeper ink for the icon and label.
 *   2. There are six tones, not one per category, so the row reads as a family.
 *   3. The mapping is by slug — data the store owns — with a deterministic
 *      fallback, so a category the admin adds tomorrow still gets a considered
 *      colour rather than grey.
 */

export interface CategoryTone {
  /** The tile's wash. */
  surface: string;
  /** The tile's hover wash — one step deeper, never a different hue. */
  surfaceHover: string;
  /** The icon disc sitting on the wash. */
  disc: string;
  /** Ink for the icon inside the disc. */
  ink: string;
}

const TONES = {
  produce: {
    surface: 'bg-leaf/10',
    surfaceHover: 'group-hover:bg-leaf/16',
    disc: 'bg-surface/80',
    ink: 'text-leaf',
  },
  chilled: {
    surface: 'bg-teal/10',
    surfaceHover: 'group-hover:bg-teal/16',
    disc: 'bg-surface/80',
    ink: 'text-teal',
  },
  bakery: {
    surface: 'bg-apricot/22',
    surfaceHover: 'group-hover:bg-apricot/32',
    disc: 'bg-surface/80',
    ink: 'text-attention',
  },
  pantry: {
    surface: 'bg-sand/55',
    surfaceHover: 'group-hover:bg-sand/75',
    disc: 'bg-surface/80',
    ink: 'text-secondary',
  },
  drinks: {
    surface: 'bg-berry/10',
    surfaceHover: 'group-hover:bg-berry/16',
    disc: 'bg-surface/80',
    ink: 'text-berry',
  },
  care: {
    surface: 'bg-peach/40',
    surfaceHover: 'group-hover:bg-peach/55',
    disc: 'bg-surface/80',
    ink: 'text-berry',
  },
} as const satisfies Record<string, CategoryTone>;

type ToneName = keyof typeof TONES;

const ORDER: ToneName[] = ['produce', 'chilled', 'bakery', 'pantry', 'drinks', 'care'];

/**
 * The aisles this store actually stocks, mapped to the tone a shopper expects.
 *
 * Written against slugs rather than names because a slug is stable and a
 * display name is not. Anything not listed falls through to the hash below —
 * which is why this map can stay short and does not have to be maintained in
 * step with the catalogue.
 */
const BY_SLUG: Record<string, ToneName> = {
  'fruits-vegetables': 'produce',
  'fresh-fruits': 'produce',
  'fresh-vegetables': 'produce',
  'dairy-eggs': 'chilled',
  milk: 'chilled',
  'yogurt-dahi': 'chilled',
  'butter-cheese': 'chilled',
  eggs: 'chilled',
  bakery: 'bakery',
  bread: 'bakery',
  'biscuits-rusk': 'bakery',
  'pantry-staples': 'pantry',
  'atta-flour': 'pantry',
  rice: 'pantry',
  'pulses-daal': 'pantry',
  'sugar-salt': 'pantry',
  'cooking-oil-ghee': 'pantry',
  beverages: 'drinks',
  'tea-coffee': 'drinks',
  'soft-drinks': 'drinks',
  'juices-water': 'drinks',
  snacks: 'bakery',
  'chips-namkeen': 'bakery',
  'chocolates-sweets': 'care',
  'home-care': 'chilled',
  laundry: 'chilled',
  'cleaning-tissue': 'chilled',
  'personal-care': 'care',
  'bath-body': 'care',
  'hair-care': 'care',
  'oral-care': 'care',
};

/** Stable per slug, so a category looks the same on every screen and visit. */
export function categoryTone(slug: string): CategoryTone {
  const named = BY_SLUG[slug];
  if (named) return TONES[named];

  let hash = 0;
  for (let index = 0; index < slug.length; index += 1) {
    hash = (hash * 31 + slug.charCodeAt(index)) | 0;
  }

  return TONES[ORDER[Math.abs(hash) % ORDER.length]];
}

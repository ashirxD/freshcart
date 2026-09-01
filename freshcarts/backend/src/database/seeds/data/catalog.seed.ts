import type { CreateStoreDto } from 'src/modules/stores/dto';

/**
 * Development catalogue for a Pakistani neighbourhood grocery.
 *
 * Products are referenced by category *slug*, not id, so this file stays a plain
 * description of the catalogue. The seeder resolves slugs and writes everything
 * through the real services, which means seeded data passes exactly the same
 * validation as anything an admin creates.
 */

export function buildSeedStore(): CreateStoreDto {
  return {
    name: 'FreshCarts Salamat Pura',
    slug: 'freshcarts-salamat-pura',
    description:
      'Your neighbourhood grocery in Salamat Pura — fresh produce, daily staples and household essentials, delivered.',
    address: {
      line1: 'Main Road, Zaitoon Colony',
      area: 'Salamat Pura',
      city: 'Lahore',
      province: 'Punjab',
      postalCode: '54000',
    },
    /**
     * Salamat Pura / Zaitoon Colony, Lahore — APPROXIMATE, and worth checking.
     *
     * This coordinate is not decoration: every delivery fee on the platform is
     * priced from the road distance between this point and the shopper's
     * address, and the service-area check measures from here too. A point that
     * is off by a kilometre misprices every delivery the store ever takes.
     *
     * Confirm it against the actual shopfront and correct it here or, once the
     * store exists, at /admin/stores.
     */
    location: { latitude: 31.5845, longitude: 74.4067 },
    // TODO: replace with the shop's real public number before going live.
    phone: '+923004567890',
    email: 'salamatpura@freshcarts.local',
    openingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      opensAt: '08:00',
      closesAt: day === 5 ? '22:00' : '23:00',
      isClosed: false,
    })),
    isActive: true,
  };
}

export interface SeedCategory {
  name: string;
  slug: string;
  icon: string;
  description?: string;
  children?: Array<{ name: string; slug: string; icon?: string }>;
}

/**
 * `icon` names come from the lucide set the frontend already depends on, so a
 * category tile renders meaningfully before anyone uploads artwork.
 */
export function buildSeedCategories(): SeedCategory[] {
  return [
    {
      name: 'Fruits & Vegetables',
      slug: 'fruits-vegetables',
      icon: 'Carrot',
      description: 'Fresh sabzi and phal, restocked every morning.',
      children: [
        { name: 'Fresh Vegetables', slug: 'fresh-vegetables' },
        { name: 'Fresh Fruits', slug: 'fresh-fruits' },
      ],
    },
    {
      name: 'Dairy & Eggs',
      slug: 'dairy-eggs',
      icon: 'Milk',
      description: 'Milk, dahi, butter, cheese and eggs.',
      children: [
        { name: 'Milk', slug: 'milk' },
        { name: 'Yogurt & Dahi', slug: 'yogurt-dahi' },
        { name: 'Butter & Cheese', slug: 'butter-cheese' },
        { name: 'Eggs', slug: 'eggs' },
      ],
    },
    {
      name: 'Bakery',
      slug: 'bakery',
      icon: 'CakeSlice',
      description: 'Bread, rusk and biscuits.',
      children: [
        { name: 'Bread', slug: 'bread' },
        { name: 'Biscuits & Rusk', slug: 'biscuits-rusk' },
      ],
    },
    {
      name: 'Pantry Staples',
      slug: 'pantry-staples',
      icon: 'Wheat',
      description: 'Atta, rice, daal, sugar, oil and ghee.',
      children: [
        { name: 'Atta & Flour', slug: 'atta-flour' },
        { name: 'Rice', slug: 'rice' },
        { name: 'Pulses & Daal', slug: 'pulses-daal' },
        { name: 'Sugar & Salt', slug: 'sugar-salt' },
        { name: 'Cooking Oil & Ghee', slug: 'cooking-oil-ghee' },
      ],
    },
    {
      name: 'Beverages',
      slug: 'beverages',
      icon: 'CupSoda',
      description: 'Chai, coffee, soft drinks, juices and water.',
      children: [
        { name: 'Tea & Coffee', slug: 'tea-coffee' },
        { name: 'Soft Drinks', slug: 'soft-drinks' },
        { name: 'Juices & Water', slug: 'juices-water' },
      ],
    },
    {
      name: 'Snacks',
      slug: 'snacks',
      icon: 'Cookie',
      description: 'Chips, nimko, chocolates and sweets.',
      children: [
        { name: 'Chips & Namkeen', slug: 'chips-namkeen' },
        { name: 'Chocolates & Sweets', slug: 'chocolates-sweets' },
      ],
    },
    {
      name: 'Home Care',
      slug: 'home-care',
      icon: 'SprayCan',
      description: 'Detergents, cleaners and tissues.',
      children: [
        { name: 'Laundry', slug: 'laundry' },
        { name: 'Cleaning & Tissue', slug: 'cleaning-tissue' },
      ],
    },
    {
      name: 'Personal Care',
      slug: 'personal-care',
      icon: 'Sparkles',
      description: 'Soap, shampoo and oral care.',
      children: [
        { name: 'Bath & Body', slug: 'bath-body' },
        { name: 'Hair Care', slug: 'hair-care' },
        { name: 'Oral Care', slug: 'oral-care' },
      ],
    },
  ];
}

/**
 * NO PRODUCTS ARE SEEDED.
 *
 * The catalogue is entered by hand, from /admin/products, by whoever actually
 * knows what the shop stocks and what it charges. Seeding invented products
 * would put fabricated prices in front of a real shopper the moment the store
 * went live, and every one of them would have to be found and deleted first.
 *
 * The category tree above IS seeded, because a product cannot be created
 * without a category to file it under — so the first product can be added
 * immediately, with no setup step in between.
 */

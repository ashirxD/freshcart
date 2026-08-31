import { Types } from 'mongoose';
import { StockStatus, UnitType } from 'src/common/enums';
import type { AiExtractedItem } from '../ai/ai-ocr.contract';
import { MatchStatus } from './match.types';
import { MAX_CANDIDATES, ProductMatcherService } from './product-matcher.service';

/**
 * §17-21 and §55.
 *
 * The candidate pool is built from real catalogue shapes and the matcher is
 * exercised as a pure function over it, so every ranking rule is pinned down
 * without a database. The one thing that needs the database — that the query
 * scopes by store and excludes inactive products — is asserted separately,
 * against the filter the service actually builds.
 */

const STORE_ID = new Types.ObjectId('64b000000000000000000001');

interface SeedProduct {
  id: string;
  name: string;
  brand?: string;
  searchTerms?: string[];
  unitType?: UnitType;
  unitValue?: number;
  price?: number;
  quantity?: number;
}

/** Builds the raw aggregation row shape the matcher indexes. */
function row(seed: SeedProduct) {
  return {
    _id: new Types.ObjectId(seed.id),
    name: seed.name,
    slug: seed.name.toLowerCase().replace(/\W+/g, '-'),
    brand: seed.brand,
    categoryId: new Types.ObjectId('64b0000000000000000000c1'),
    subcategoryId: null,
    storeId: STORE_ID,
    images: [],
    sellingPrice: seed.price ?? 300,
    compareAtPrice: null,
    unitType: seed.unitType ?? UnitType.PIECE,
    unitValue: seed.unitValue ?? 1,
    sku: 'SKU-' + seed.id.slice(-3),
    searchTerms: seed.searchTerms ?? [],
    isActive: true,
    isFeatured: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    stockRow: [{ quantity: seed.quantity ?? 40, lowStockThreshold: 5 }],
  };
}

/** The private indexer, reached the way the service reaches it. */
function pool(seeds: SeedProduct[]) {
  const index = (
    ProductMatcherService as unknown as { index: (r: ReturnType<typeof row>) => unknown }
  ).index;

  return seeds.map((seed) => index(row(seed)));
}

function item(overrides: Partial<AiExtractedItem> = {}): AiExtractedItem {
  return {
    rawText: 'milk',
    normalizedName: 'milk',
    quantity: 1,
    unit: null,
    unitValue: null,
    brand: null,
    qualifiers: [],
    confidence: 0.9,
    recognized: true,
    quantityAdjusted: false,
    script: 'latin',
    ...overrides,
  };
}

// A slice of the seeded FreshCarts catalogue, including the ambiguity §20 uses.
const CATALOGUE: SeedProduct[] = [
  {
    id: '64b000000000000000000101',
    name: "Olper's Full Cream Milk",
    brand: "Olper's",
    searchTerms: ['doodh', 'dodh', 'milk', 'olpers'],
    unitType: UnitType.LITER,
    unitValue: 1,
    price: 340,
  },
  {
    id: '64b000000000000000000102',
    name: 'Milkpak Full Cream Milk',
    brand: 'Milkpak',
    searchTerms: ['doodh', 'milkpak', 'milk'],
    unitType: UnitType.LITER,
    unitValue: 1,
    price: 330,
  },
  {
    id: '64b000000000000000000103',
    name: 'Surf Excel Washing Powder',
    brand: 'Surf Excel',
    searchTerms: ['surf', 'detergent', 'washing powder', 'sarf'],
    unitType: UnitType.KG,
    unitValue: 1,
    price: 690,
  },
  {
    id: '64b000000000000000000104',
    name: 'Ariel Detergent Powder',
    brand: 'Ariel',
    searchTerms: ['ariel', 'detergent', 'washing powder'],
    unitType: UnitType.G,
    unitValue: 500,
    price: 390,
  },
  {
    id: '64b000000000000000000105',
    name: 'Sunridge Chakki Atta',
    searchTerms: ['atta', 'aata', 'flour', 'gandum'],
    unitType: UnitType.KG,
    unitValue: 5,
    price: 1250,
  },
  {
    id: '64b000000000000000000106',
    name: 'Bake Parlor Chakki Atta',
    searchTerms: ['atta', 'aata', 'flour'],
    unitType: UnitType.KG,
    unitValue: 1,
    price: 280,
  },
  {
    id: '64b000000000000000000107',
    name: 'Guard Super Basmati Rice',
    searchTerms: ['chawal', 'rice', 'basmati'],
    unitType: UnitType.KG,
    unitValue: 5,
    price: 2100,
  },
];

function rank(source: AiExtractedItem, seeds: SeedProduct[] = CATALOGUE) {
  return ProductMatcherService.rank(source, pool(seeds) as never);
}

function classify(source: AiExtractedItem, seeds: SeedProduct[] = CATALOGUE) {
  return ProductMatcherService.classify(source, rank(source, seeds));
}

describe('ProductMatcherService ranking', () => {
  describe('exact matches', () => {
    it('finds a product by the exact name a shopper wrote', () => {
      const results = rank(
        item({ normalizedName: "Olper's Full Cream Milk", rawText: 'olpers milk' }),
      );

      expect(results[0].product.name).toBe("Olper's Full Cream Milk");
    });

    it('finds a product through a Roman-Urdu alias', () => {
      // The whole point of `searchTerms`: "doodh" is not in any product name.
      const results = rank(item({ normalizedName: 'milk', rawText: '2 doodh' }));

      expect(results.map((r) => r.product.name)).toContain("Olper's Full Cream Milk");
      expect(results.map((r) => r.product.name)).toContain('Milkpak Full Cream Milk');
    });

    it('never lets a fuzzy match outrank an exact catalogue hit', () => {
      // §18, stated as a hard rule. The score tiers are what enforce it: no
      // unit bonus can lift a fuzzy match into the exact band.
      const results = rank(item({ normalizedName: 'atta', rawText: 'atta' }), [
        ...CATALOGUE,
        // A near-miss on spelling that must not win.
        { id: '64b0000000000000000001ff', name: 'Atto Cleaning Cloth', searchTerms: [] },
      ]);

      expect(results[0].product.name).toMatch(/Atta/);
    });
  });

  describe('the §18 invariant', () => {
    it('cannot let a fuzzy match beat an exact alias, however many bonuses it collects', () => {
      // The strongest possible fuzzy candidate — right brand, right pack size,
      // a name one letter away — against a product that simply answers to the
      // word. The tiers are chosen so this ordering is arithmetic, not luck.
      const results = rank(
        item({
          normalizedName: 'flour',
          rawText: 'attu 1 kg',
          brand: 'Impostor',
          unit: 'kg',
          unitValue: 1,
        }),
        [
          CATALOGUE[5], // Bake Parlor Chakki Atta — alias "flour", 1 kg.
          {
            id: '64b0000000000000000001fe',
            name: 'Attu Floor Cleaner',
            brand: 'Impostor',
            searchTerms: [],
            unitType: UnitType.KG,
            unitValue: 1,
          },
        ],
      );

      expect(results[0].product.name).toBe('Bake Parlor Chakki Atta');
    });
  });

  describe('brand matching', () => {
    it('prefers the named brand over another product of the same kind', () => {
      const results = rank(
        item({ normalizedName: 'milk', rawText: "olper's milk", brand: "Olper's" }),
      );

      expect(results[0].product.name).toBe("Olper's Full Cream Milk");
    });

    it('reaches a product through the brand the shopper actually wrote', () => {
      // "Surf 1" normalises to "detergent", which finds every washing powder.
      // The raw word "surf" is what identifies the right one — which is why
      // both the normalised name and the raw text are searched.
      const results = rank(item({ normalizedName: 'detergent', rawText: 'surf 1' }));

      expect(results[0].product.name).toBe('Surf Excel Washing Powder');
    });
  });

  describe('unit compatibility (§21)', () => {
    it('prefers the pack size the shopper asked for', () => {
      const results = rank(
        item({ normalizedName: 'flour', rawText: '5 kg atta', unit: 'kg', unitValue: 5 }),
      );

      expect(results[0].product.name).toBe('Sunridge Chakki Atta');
      expect(results[0].unitMatches).toBe(true);
    });

    it('prefers the smaller pack when that is what was asked for', () => {
      const results = rank(
        item({ normalizedName: 'flour', rawText: '1 kg atta', unit: 'kg', unitValue: 1 }),
      );

      expect(results[0].product.name).toBe('Bake Parlor Chakki Atta');
    });

    it('still offers a product whose pack size does not match', () => {
      // §21 is explicit: a unit mismatch must not reject a product. A shopper
      // shown the wrong size has been helped; a shopper shown nothing has not.
      const results = rank(
        item({ normalizedName: 'flour', rawText: '2 kg atta', unit: 'kg', unitValue: 2 }),
      );

      expect(results).toHaveLength(2);
    });

    it('ranks a compatible size above an incompatible one', () => {
      // A kilo of detergent against a 500 g box: same family, so both stay,
      // but the one that can satisfy the request comes first.
      const results = rank(
        item({ normalizedName: 'detergent', rawText: '1 kg detergent', unit: 'kg', unitValue: 1 }),
      );

      expect(results[0].product.name).toBe('Surf Excel Washing Powder');
    });

    it('does not let a unit bonus rescue an unrelated product', () => {
      const results = rank(
        item({ normalizedName: 'zafraan', rawText: 'zafraan', unit: 'kg', unitValue: 5 }),
      );

      expect(results).toHaveLength(0);
    });
  });

  describe('candidate limits (§54)', () => {
    it('never returns more than a handful of choices', () => {
      const many = Array.from({ length: 20 }, (_, index) => ({
        id: '64b0000000000000000002' + index.toString().padStart(2, '0'),
        name: 'Milk Brand ' + index,
        searchTerms: ['milk', 'doodh'],
      }));

      expect(rank(item({ normalizedName: 'milk' }), many).length).toBeLessThanOrEqual(
        MAX_CANDIDATES,
      );
    });

    it('orders identically scored products deterministically', () => {
      // Without a tiebreak the same scan would reorder between requests, and a
      // shopper who scrolled away and back would see a different list.
      const source = item({ normalizedName: 'milk' });
      const first = rank(source).map((r) => r.product.id);
      const second = rank(source).map((r) => r.product.id);

      expect(first).toEqual(second);
    });
  });

  describe('stock', () => {
    it('ranks an in-stock product above an identical sold-out one', () => {
      const results = rank(item({ normalizedName: 'milk', rawText: 'doodh' }), [
        { ...CATALOGUE[0], quantity: 0 },
        CATALOGUE[1],
      ]);

      expect(results[0].product.name).toBe('Milkpak Full Cream Milk');
    });

    it('still offers a sold-out product rather than hiding it', () => {
      // The shopper is better served by "we stock this, but not today" than by
      // "we could not find this item".
      const results = rank(item({ normalizedName: 'milk', rawText: 'doodh' }), [
        { ...CATALOGUE[0], quantity: 0 },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].product.stock.status).toBe(StockStatus.OUT_OF_STOCK);
    });
  });
});

describe('ProductMatcherService classification (§24)', () => {
  it('reports MATCHED when one product is clearly right', () => {
    expect(
      classify(item({ normalizedName: 'flour', rawText: '5 kg atta', unit: 'kg', unitValue: 5 })),
    ).toBe(MatchStatus.MATCHED);
  });

  it('reports AMBIGUOUS when two products are equally plausible', () => {
    // §20's own example: "surf" against several detergents. Auto-selecting one
    // is precisely what §27 forbids.
    expect(classify(item({ normalizedName: 'detergent', rawText: 'detergent' }))).toBe(
      MatchStatus.AMBIGUOUS,
    );
  });

  it('reports AMBIGUOUS for two brands of the same thing with no brand given', () => {
    expect(classify(item({ normalizedName: 'milk', rawText: '2 doodh' }))).toBe(
      MatchStatus.AMBIGUOUS,
    );
  });

  it('resolves the ambiguity once a brand is named', () => {
    expect(
      classify(item({ normalizedName: 'milk', rawText: "olper's doodh", brand: "Olper's" })),
    ).toBe(MatchStatus.MATCHED);
  });

  it('reports NOT_FOUND when nothing credible exists', () => {
    // §28: one unknown item must not block the list, so this is an ordinary
    // outcome with its own screen, not an error.
    expect(classify(item({ normalizedName: 'saffron threads', rawText: 'zafraan' }))).toBe(
      MatchStatus.NOT_FOUND,
    );
  });

  it('reports INVALID when the extracted item has no name at all', () => {
    expect(ProductMatcherService.classify(item({ normalizedName: '   ' }), [])).toBe(
      MatchStatus.INVALID,
    );
  });

  it('never reports MATCHED on a weak leader, even with no competition', () => {
    // A single mediocre candidate is still a question for the shopper.
    const status = classify(item({ normalizedName: 'chakki', rawText: 'chakki' }), [CATALOGUE[4]]);

    expect(status).toBe(MatchStatus.AMBIGUOUS);
  });
});

describe('ProductMatcherService confidence bands (§19)', () => {
  it('reports a category rather than a false-precision percentage', () => {
    expect(ProductMatcherService.confidenceOf(200)).toBe('HIGH');
    expect(ProductMatcherService.confidenceOf(100)).toBe('MEDIUM');
    expect(ProductMatcherService.confidenceOf(50)).toBe('LOW');
  });
});

describe('ProductMatcherService catalogue query', () => {
  it('scopes to the store and to active products, in the filter itself', async () => {
    // §55: a product from another store is never fetched, so it can never be
    // ranked, offered or added — the scope is not a check applied afterwards.
    const aggregate = jest.fn().mockReturnValue({ exec: () => Promise.resolve([]) });
    const service = new ProductMatcherService({ aggregate } as never);

    await service.matchAll([item({ normalizedName: 'milk' })], STORE_ID);

    const [pipeline] = aggregate.mock.calls[0] as [Array<Record<string, never>>];
    const match = pipeline[0].$match as unknown as Record<string, unknown>;

    expect(match.storeId).toBe(STORE_ID);
    expect(match.isActive).toBe(true);
  });

  it('issues one query for a whole list rather than one per item', async () => {
    // §53 and §68. A twelve-item list costs one round trip.
    const aggregate = jest.fn().mockReturnValue({ exec: () => Promise.resolve([]) });
    const service = new ProductMatcherService({ aggregate } as never);

    await service.matchAll(
      [
        item({ normalizedName: 'milk' }),
        item({ normalizedName: 'sugar' }),
        item({ normalizedName: 'eggs' }),
        item({ normalizedName: 'flour' }),
      ],
      STORE_ID,
    );

    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it('bounds the candidate pool before joining stock', async () => {
    const aggregate = jest.fn().mockReturnValue({ exec: () => Promise.resolve([]) });
    const service = new ProductMatcherService({ aggregate } as never);

    await service.matchAll([item({ normalizedName: 'milk' })], STORE_ID);

    const [pipeline] = aggregate.mock.calls[0] as [Array<Record<string, unknown>>];
    const limitIndex = pipeline.findIndex((stage) => '$limit' in stage);
    const lookupIndex = pipeline.findIndex((stage) => '$lookup' in stage);

    expect(limitIndex).toBeGreaterThanOrEqual(0);
    expect(limitIndex).toBeLessThan(lookupIndex);
  });

  it('does not query at all for an empty list', async () => {
    const aggregate = jest.fn();
    const service = new ProductMatcherService({ aggregate } as never);

    await expect(service.matchAll([], STORE_ID)).resolves.toEqual([]);
    expect(aggregate).not.toHaveBeenCalled();
  });
});

import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { BusinessException, ErrorCode } from 'src/common/errors';
import { CartService } from 'src/modules/cart/cart.service';
import { StoresService } from 'src/modules/stores';
import { AiOcrClient } from './ai/ai-ocr.client';
import type { AiGroceryListResponse } from './ai/ai-ocr.contract';
import { GroceryScanService } from './grocery-scan.service';
import { MatchStatus } from './matching/match.types';
import { ProductMatcherService } from './matching/product-matcher.service';
import type { UploadedImage } from './upload/image-upload';

/**
 * §29, §31, §34, §60, §61 and §62.
 *
 * The two halves of the flow are tested for opposite properties: scanning must
 * change nothing, and confirming must trust nothing.
 */

const STORE_ID = new Types.ObjectId('64b000000000000000000001');
const USER_ID = '64b000000000000000000009';
const MILK_ID = '64b000000000000000000101';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function image(overrides: Partial<UploadedImage> = {}): UploadedImage {
  return {
    originalname: 'list.jpg',
    mimetype: 'image/jpeg',
    size: JPEG.length,
    buffer: JPEG,
    ...overrides,
  };
}

function aiResponse(overrides: Partial<AiGroceryListResponse> = {}): AiGroceryListResponse {
  return {
    version: '1',
    requestId: 'ai-1',
    language: 'en',
    rawText: '2 doodh',
    items: [
      {
        rawText: '2 doodh',
        normalizedName: 'milk',
        quantity: 2,
        unit: null,
        unitValue: null,
        brand: null,
        qualifiers: [],
        confidence: 0.9,
        recognized: true,
        quantityAdjusted: false,
        script: 'latin',
      },
    ],
    warnings: [],
    diagnostics: {
      engineConfidence: 0.9,
      confidenceBand: 'HIGH',
      lineCount: 1,
      skippedLineCount: 0,
      processingMs: 700,
    },
    ...overrides,
  };
}

function matchResult(status = MatchStatus.MATCHED) {
  return [
    {
      status,
      candidates: [
        {
          score: 200,
          unitMatches: true,
          product: {
            id: MILK_ID,
            name: "Olper's Full Cream Milk",
            brand: "Olper's",
            primaryImage: null,
            unitLabel: '1 L',
            sellingPrice: 340,
            stock: { quantity: 20, lowStockThreshold: 5, status: 'IN_STOCK', isAvailable: true },
          },
        },
      ],
    },
  ] as never;
}

interface Doubles {
  aiClient: { readGroceryList: jest.Mock; isHealthy: jest.Mock };
  matcher: { matchAll: jest.Mock };
  cartService: { addItems: jest.Mock };
}

function build(overrides: Partial<Doubles> = {}) {
  const aiClient = overrides.aiClient ?? {
    readGroceryList: jest.fn().mockResolvedValue(aiResponse()),
    isHealthy: jest.fn().mockResolvedValue(true),
  };

  const matcher = overrides.matcher ?? { matchAll: jest.fn().mockResolvedValue(matchResult()) };

  const cartService = overrides.cartService ?? {
    addItems: jest.fn().mockResolvedValue({ cart: { itemCount: 1 }, added: [], failed: [] }),
  };

  const storesService = {
    getActiveStoreObjectId: jest.fn().mockResolvedValue(STORE_ID),
  } as unknown as StoresService;

  const configService = {
    get: () => ({ maxImageBytes: 8 * 1024 * 1024, rateLimit: 10, rateLimitTtlMs: 300_000 }),
  } as unknown as ConfigService<AppConfig, true>;

  const service = new GroceryScanService(
    aiClient as unknown as AiOcrClient,
    matcher as unknown as ProductMatcherService,
    cartService as unknown as CartService,
    storesService,
    configService,
  );

  return { service, aiClient, matcher, cartService, storesService };
}

describe('GroceryScanService.scan', () => {
  it('returns matched items with the catalogue price, not one from the AI', () => {
    const { service } = build();

    return service.scan(USER_ID, image()).then((result) => {
      expect(result.items).toHaveLength(1);
      expect(result.items[0].match.status).toBe(MatchStatus.MATCHED);
      expect(result.items[0].match.product?.price).toBe(340);
    });
  });

  it('changes nothing — a scan is a read', async () => {
    // §60: the shopper reviews before anything happens, which is what makes an
    // uncertain match harmless.
    const { service, cartService } = build();

    await service.scan(USER_ID, image());

    expect(cartService.addItems).not.toHaveBeenCalled();
  });

  it('carries the raw text through so a wrong match is explainable', async () => {
    // §10: the shopper sees what they actually wrote next to what we found.
    const { service } = build();

    const result = await service.scan(USER_ID, image());

    expect(result.items[0].source.rawText).toBe('2 doodh');
  });

  it('leaves an ambiguous line unselected', async () => {
    // §27: pre-selecting the leader is how a shopper buys the wrong thing
    // because they trusted a tick they did not read.
    const { service } = build({
      matcher: { matchAll: jest.fn().mockResolvedValue(matchResult(MatchStatus.AMBIGUOUS)) },
    });

    const result = await service.scan(USER_ID, image());

    expect(result.items[0].match.product).toBeNull();
    expect(result.items[0].alternatives).toHaveLength(1);
  });

  it('sends a correlation id and never the shopper identity', async () => {
    // §42: a log line that identifies a shopper is a log line that should not
    // exist, and the id travels to a third-party process.
    const { service, aiClient } = build();

    await service.scan(USER_ID, image());

    const [request] = aiClient.readGroceryList.mock.calls[0];
    expect(request.requestId).toEqual(expect.any(String));
    expect(request.requestId).not.toContain(USER_ID);
    expect(request.filename).toBe('grocery-list.jpeg');
  });

  it('rejects a file that is not an image before calling the AI service', async () => {
    const { service, aiClient } = build();

    await expect(
      service.scan(USER_ID, image({ buffer: Buffer.from('<?php system($_GET[0]); ?>') })),
    ).rejects.toMatchObject({ code: ErrorCode.IMAGE_INVALID });

    expect(aiClient.readGroceryList).not.toHaveBeenCalled();
  });

  it('rejects a missing file', async () => {
    const { service } = build();

    await expect(service.scan(USER_ID, undefined)).rejects.toBeInstanceOf(BusinessException);
  });

  it('summarises the outcome for the review screen', async () => {
    const matcher = {
      matchAll: jest
        .fn()
        .mockResolvedValue([
          ...matchResult(MatchStatus.MATCHED),
          ...matchResult(MatchStatus.AMBIGUOUS),
          { status: MatchStatus.NOT_FOUND, candidates: [] },
        ] as never),
    };

    const { service } = build({
      aiClient: {
        readGroceryList: jest.fn().mockResolvedValue(
          aiResponse({
            items: [aiResponse().items[0], aiResponse().items[0], aiResponse().items[0]],
          }),
        ),
        isHealthy: jest.fn(),
      },
      matcher,
    });

    const result = await service.scan(USER_ID, image());

    // §31: "We found 3 items. 1 is ready to add. 1 needs your help."
    expect(result.summary).toMatchObject({
      detected: 3,
      matched: 1,
      ambiguous: 1,
      notFound: 1,
    });
    expect(result.summary.estimatedTotal).toBe(680);
  });
});

describe('GroceryScanService.availability', () => {
  it('reports unavailable when the AI service is down, rather than failing', async () => {
    // §37: the rest of FreshCarts is unaffected. The entry point is simply
    // hidden, so nobody photographs a list only to be told we cannot read it.
    const { service } = build({
      aiClient: { readGroceryList: jest.fn(), isHealthy: jest.fn().mockResolvedValue(false) },
    });

    await expect(service.availability()).resolves.toEqual({ available: false });
  });
});

describe('GroceryScanService.confirm', () => {
  it('passes only product ids and quantities to the cart', async () => {
    // §61: no price, no name, no unit. The cart re-reads everything.
    const { service, cartService } = build();

    await service.confirm(USER_ID, {
      items: [{ productId: MILK_ID, quantity: 2 }],
    });

    expect(cartService.addItems).toHaveBeenCalledWith(USER_ID, [
      { productId: MILK_ID, quantity: 2 },
    ]);
  });

  it('reports partial success rather than failing the whole list', async () => {
    // §31 and §62: one sold-out item must not cost the shopper the other three.
    const { service } = build({
      cartService: {
        addItems: jest.fn().mockResolvedValue({
          cart: { itemCount: 2 },
          added: [
            { productId: MILK_ID, productName: "Olper's Milk", quantity: 2 },
            { productId: 'p2', productName: 'Sugar', quantity: 1 },
          ],
          failed: [
            {
              productId: 'p3',
              productName: 'Desi Anday',
              requestedQuantity: 10,
              reason: 'INSUFFICIENT_STOCK',
              availableQuantity: 4,
            },
          ],
        }),
      },
    });

    const result = await service.confirm(USER_ID, {
      items: [{ productId: MILK_ID, quantity: 2 }],
    });

    expect(result.added).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    // §33: the shopper is told how many there actually are, so they can choose.
    expect(result.failed[0].reason).toBe('Only 4 are available');
    expect(result.failed[0].availableQuantity).toBe(4);
  });

  it('returns the recalculated cart so no second request is needed', async () => {
    // §63: the cart badge updates immediately, from the server's own figures.
    const { service } = build();

    const result = await service.confirm(USER_ID, {
      items: [{ productId: MILK_ID, quantity: 1 }],
    });

    expect(result.cart).toEqual({ itemCount: 1 });
  });

  it('explains every failure reason in words a shopper can act on', async () => {
    const reasons = [
      ['PRODUCT_NOT_FOUND', /no longer in our catalogue/i],
      ['UNAVAILABLE', /not available/i],
      ['OUT_OF_STOCK', /out of stock/i],
      ['CART_FULL', /cart is already full/i],
    ] as const;

    for (const [reason, expected] of reasons) {
      const { service } = build({
        cartService: {
          addItems: jest.fn().mockResolvedValue({
            cart: {},
            added: [],
            failed: [{ productId: 'p1', productName: 'Milk', requestedQuantity: 1, reason }],
          }),
        },
      });

      const result = await service.confirm(USER_ID, { items: [{ productId: 'p1', quantity: 1 }] });
      expect(result.failed[0].reason).toMatch(expected);
    }
  });
});

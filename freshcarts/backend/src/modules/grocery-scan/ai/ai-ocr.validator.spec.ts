import { MalformedAiResponseError, validateOcrResponse } from './ai-ocr.validator';

/**
 * §39: an AI response is untrusted input.
 *
 * These tests are written from the position that the Python service is hostile
 * — not because it is, but because it is a separate process on the other side
 * of a network with its own deployment cycle, and every one of these payloads
 * is something a version skew or a bug could genuinely produce.
 */

function response(overrides: Record<string, unknown> = {}) {
  return {
    version: '1',
    requestId: 'scan-1',
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
        confidence: 0.91,
        recognized: true,
        quantityAdjusted: false,
        script: 'latin',
      },
    ],
    warnings: [],
    diagnostics: {
      engineConfidence: 0.91,
      confidenceBand: 'HIGH',
      lineCount: 1,
      skippedLineCount: 0,
      processingMs: 800,
    },
    ...overrides,
  };
}

describe('validateOcrResponse', () => {
  describe('a well-formed response', () => {
    it('passes through with its values intact', () => {
      const result = validateOcrResponse(response());

      expect(result.items).toHaveLength(1);
      expect(result.items[0].normalizedName).toBe('milk');
      expect(result.items[0].quantity).toBe(2);
      expect(result.diagnostics.confidenceBand).toBe('HIGH');
    });
  });

  describe('responses that cannot be trusted at all', () => {
    it.each([
      ['null', null],
      ['a string', 'ok'],
      ['an array', []],
      ['a number', 42],
    ])('rejects %s', (_label, payload) => {
      expect(() => validateOcrResponse(payload)).toThrow(MalformedAiResponseError);
    });

    it('rejects a contract version it does not understand', () => {
      // Version is checked BEFORE the fields are read, so a future payload is
      // never half-interpreted under this version's rules.
      expect(() => validateOcrResponse(response({ version: '2' }))).toThrow(
        /contract version 2 is not supported/,
      );
    });

    it('rejects a missing items array', () => {
      expect(() => validateOcrResponse(response({ items: undefined }))).toThrow(
        MalformedAiResponseError,
      );
    });

    it('rejects items sent as an object rather than an array', () => {
      expect(() => validateOcrResponse(response({ items: { first: {} } }))).toThrow(
        MalformedAiResponseError,
      );
    });
  });

  describe('individual items that are wrong', () => {
    it('drops an item with no usable name but keeps the rest', () => {
      // One unreadable line must not cost the shopper the other nine.
      const result = validateOcrResponse(
        response({
          items: [{ normalizedName: '   ', quantity: 1 }, response().items[0]],
        }),
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].normalizedName).toBe('milk');
    });

    it.each([
      ['a string', 'many'],
      ['null', null],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ])('falls back to a quantity of 1 when quantity is %s', (_label, quantity) => {
      const result = validateOcrResponse(
        response({ items: [{ ...response().items[0], quantity }] }),
      );

      expect(result.items[0].quantity).toBe(1);
    });

    it('clamps an absurd quantity rather than passing it on', () => {
      // The failure this prevents: a shopper staring at an order for ten
      // thousand eggs and abandoning the feature.
      const result = validateOcrResponse(
        response({ items: [{ ...response().items[0], quantity: 10_000 }] }),
      );

      expect(result.items[0].quantity).toBe(99);
    });

    it('rejects a negative quantity', () => {
      const result = validateOcrResponse(
        response({ items: [{ ...response().items[0], quantity: -5 }] }),
      );

      expect(result.items[0].quantity).toBe(1);
    });

    it('discards a unit that is not in the agreed vocabulary', () => {
      const result = validateOcrResponse(
        response({ items: [{ ...response().items[0], unit: 'furlong', unitValue: 3 }] }),
      );

      expect(result.items[0].unit).toBeNull();
      // A size with no unit is meaningless, so the pair is kept consistent.
      expect(result.items[0].unitValue).toBeNull();
    });

    it('discards an implausible pack size', () => {
      const result = validateOcrResponse(
        response({ items: [{ ...response().items[0], unit: 'kg', unitValue: 10_000_000 }] }),
      );

      expect(result.items[0].unitValue).toBeNull();
    });

    it('truncates an enormous name rather than storing it', () => {
      const result = validateOcrResponse(
        response({ items: [{ ...response().items[0], normalizedName: 'a'.repeat(5_000) }] }),
      );

      expect(result.items[0].normalizedName).toHaveLength(200);
    });

    it('caps the number of items regardless of what was sent', () => {
      const result = validateOcrResponse(
        response({ items: Array.from({ length: 500 }, () => response().items[0]) }),
      );

      expect(result.items).toHaveLength(60);
    });
  });

  describe('confidence', () => {
    it('keeps a missing confidence as null rather than inventing zero', () => {
      // §11. Rendering "0% confident" about a line that was read perfectly is
      // worse than saying nothing.
      const result = validateOcrResponse(
        response({ items: [{ ...response().items[0], confidence: null }] }),
      );

      expect(result.items[0].confidence).toBeNull();
    });

    it('treats a non-numeric confidence as unreported', () => {
      const result = validateOcrResponse(
        response({ items: [{ ...response().items[0], confidence: 'high' }] }),
      );

      expect(result.items[0].confidence).toBeNull();
    });

    it('clamps a confidence outside 0..1', () => {
      const result = validateOcrResponse(
        response({ items: [{ ...response().items[0], confidence: 4.2 }] }),
      );

      expect(result.items[0].confidence).toBe(1);
    });
  });

  describe('fields the AI service must not be able to introduce', () => {
    it('ignores a product id, a price and a store id if one is sent', () => {
      // §0 and §61. Even if the AI service invented these fields, nothing
      // downstream would ever see them: the validator constructs the item from
      // known keys rather than copying the payload.
      const result = validateOcrResponse(
        response({
          items: [
            {
              ...response().items[0],
              productId: '64b000000000000000000101',
              price: 1,
              storeId: 'other-store',
            },
          ],
        }),
      );

      expect(result.items[0]).not.toHaveProperty('productId');
      expect(result.items[0]).not.toHaveProperty('price');
      expect(result.items[0]).not.toHaveProperty('storeId');
    });
  });

  describe('diagnostics', () => {
    it('substitutes safe defaults when they are missing entirely', () => {
      const result = validateOcrResponse(response({ diagnostics: undefined }));

      expect(result.diagnostics.confidenceBand).toBe('UNKNOWN');
      expect(result.diagnostics.lineCount).toBe(0);
    });

    it('rejects a negative duration', () => {
      const result = validateOcrResponse(
        response({ diagnostics: { ...response().diagnostics, processingMs: -1 } }),
      );

      expect(result.diagnostics.processingMs).toBe(0);
    });
  });
});

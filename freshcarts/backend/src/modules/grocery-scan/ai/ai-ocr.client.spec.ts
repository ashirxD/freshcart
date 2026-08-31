import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/common/config/configuration';
import { BusinessException, ErrorCode } from 'src/common/errors';
import { AiOcrClient } from './ai-ocr.client';

/**
 * §35, §36, §37 and §39.
 *
 * The AI service is the one thing FreshCarts depends on that it does not
 * control, so every way it can fail — offline, slow, broken, lying — has to end
 * in a sentence a shopper can read and an application that still works.
 */

const CONFIG = {
  ai: { baseUrl: 'http://ai.internal:8000', timeoutMs: 5_000, connectRetries: 1, enabled: true },
  scan: { maxImageBytes: 8 * 1024 * 1024, rateLimit: 10, rateLimitTtlMs: 300_000 },
};

function buildClient(overrides: Partial<typeof CONFIG.ai> = {}) {
  const config = { ...CONFIG, ai: { ...CONFIG.ai, ...overrides } };

  const configService = {
    get: (key: keyof typeof config) => config[key],
  } as unknown as ConfigService<AppConfig, true>;

  return new AiOcrClient(configService);
}

function request() {
  return {
    image: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    filename: 'grocery-list.jpeg',
    contentType: 'image/jpeg',
    requestId: 'scan-1',
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_BODY = {
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
};

/** Asserts the failure is the expected business error, not a leaked internal. */
async function expectBusinessError(promise: Promise<unknown>, code: ErrorCode) {
  await expect(promise).rejects.toBeInstanceOf(BusinessException);
  await promise.catch((error: BusinessException) => expect(error.code).toBe(code));
}

describe('AiOcrClient', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('a successful scan', () => {
    it('returns validated items', async () => {
      fetchMock.mockResolvedValue(jsonResponse(VALID_BODY));

      const result = await buildClient().readGroceryList(request());

      expect(result.items).toHaveLength(1);
      expect(result.items[0].normalizedName).toBe('milk');
    });

    it('sends the correlation id so one id spans all three tiers', () => {
      // §72: the same id appears in the frontend, NestJS and FastAPI logs.
      fetchMock.mockResolvedValue(jsonResponse(VALID_BODY));

      return buildClient()
        .readGroceryList(request())
        .then(() => {
          const [, options] = fetchMock.mock.calls[0];
          expect(options.headers['X-Request-Id']).toBe('scan-1');
        });
    });

    it('posts to the versioned OCR path', () => {
      fetchMock.mockResolvedValue(jsonResponse(VALID_BODY));

      return buildClient()
        .readGroceryList(request())
        .then(() => {
          expect(fetchMock.mock.calls[0][0]).toBe(
            'http://ai.internal:8000/api/v1/ocr/grocery-list',
          );
        });
    });

    it('always sends a bounded request', async () => {
      // §36: a hung AI service must never hold a FreshCarts request open.
      fetchMock.mockResolvedValue(jsonResponse(VALID_BODY));

      await buildClient().readGroceryList(request());

      expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('when the AI service cannot be reached', () => {
    it('retries a connection failure, because nothing was processed', async () => {
      fetchMock
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(jsonResponse(VALID_BODY));

      const result = await buildClient().readGroceryList(request());

      expect(result.items).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('gives up after the configured attempts with a shopper-facing message', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      await expectBusinessError(
        buildClient({ connectRetries: 1 }).readGroceryList(request()),
        ErrorCode.SCAN_UNAVAILABLE,
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry at all when retries are disabled', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      await expectBusinessError(
        buildClient({ connectRetries: 0 }).readGroceryList(request()),
        ErrorCode.SCAN_UNAVAILABLE,
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the AI service is too slow', () => {
    it('never retries a timeout', async () => {
      // A timeout means the image WAS received and OCR is running. Sending it
      // again would run the expensive step twice and still time out.
      const timeout = new Error('The operation was aborted due to timeout');
      timeout.name = 'TimeoutError';
      fetchMock.mockRejectedValue(timeout);

      await expectBusinessError(
        buildClient().readGroceryList(request()),
        ErrorCode.SCAN_UNAVAILABLE,
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('never exposes the underlying timeout to the shopper', async () => {
      const timeout = new Error('connect ETIMEDOUT 10.0.0.4:8000');
      timeout.name = 'TimeoutError';
      fetchMock.mockRejectedValue(timeout);

      // §36: no TimeoutError, no ConnectionRefused, no host or port.
      await buildClient()
        .readGroceryList(request())
        .catch((error: BusinessException) => {
          expect(error.message).not.toMatch(/ETIMEDOUT|10\.0\.0\.4|TimeoutError/);
          expect(error.message).toMatch(/try again/i);
        });
    });
  });

  describe('when the AI service refuses the image', () => {
    it.each([
      [400, ErrorCode.IMAGE_INVALID],
      [413, ErrorCode.IMAGE_TOO_LARGE],
      [422, ErrorCode.IMAGE_UNREADABLE],
      [503, ErrorCode.SCAN_UNAVAILABLE],
      [504, ErrorCode.SCAN_UNAVAILABLE],
      [500, ErrorCode.SCAN_FAILED],
    ])('translates %i into %s', async (status, code) => {
      fetchMock.mockResolvedValue(jsonResponse({ code: 'SOMETHING', message: 'x' }, status));

      await expectBusinessError(buildClient().readGroceryList(request()), code);
    });
  });

  describe('when the AI service returns something unusable', () => {
    it('treats a malformed payload as a service failure, not as data', async () => {
      // §39: malformed AI output never reaches the matcher, and certainly never
      // reaches the cart.
      fetchMock.mockResolvedValue(jsonResponse({ version: '1', items: 'not-an-array' }));

      await expectBusinessError(buildClient().readGroceryList(request()), ErrorCode.SCAN_FAILED);
    });

    it('treats a non-JSON body as a service failure', async () => {
      fetchMock.mockResolvedValue(new Response('<html>502 Bad Gateway</html>', { status: 200 }));

      await expectBusinessError(buildClient().readGroceryList(request()), ErrorCode.SCAN_FAILED);
    });

    it('refuses a contract version it was not built for', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ...VALID_BODY, version: '9' }));

      await expectBusinessError(buildClient().readGroceryList(request()), ErrorCode.SCAN_FAILED);
    });
  });

  describe('when scanning is switched off', () => {
    it('refuses without calling out', async () => {
      const client = buildClient({ enabled: false });

      await expectBusinessError(client.readGroceryList(request()), ErrorCode.SCAN_UNAVAILABLE);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports itself as unhealthy', async () => {
      await expect(buildClient({ enabled: false }).isHealthy()).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('health', () => {
    it('is healthy only when the engine is actually installed', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ status: 'ok' }));
      await expect(buildClient().isHealthy()).resolves.toBe(true);

      // "degraded" means the process is up but cannot read anything, which is
      // not a state to offer the shopper a camera button in.
      fetchMock.mockResolvedValue(jsonResponse({ status: 'degraded' }));
      await expect(buildClient().isHealthy()).resolves.toBe(false);
    });

    it('reports unhealthy rather than throwing when the service is down', async () => {
      // §37: the rest of FreshCarts must be unaffected, so this can never throw
      // into a page render.
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      await expect(buildClient().isHealthy()).resolves.toBe(false);
    });
  });
});

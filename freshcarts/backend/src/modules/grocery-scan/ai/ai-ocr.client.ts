/**
 * The only thing in FreshCarts that talks to the Python AI service.
 *
 * Everything about that conversation is contained here: the URL, the timeout,
 * the retry policy, the correlation header, and the translation of every
 * possible failure into a `BusinessException` the rest of the application
 * already knows how to render. Nothing downstream learns that FastAPI exists.
 *
 * THE RULES THIS CLIENT ENFORCES
 *
 *   §36  Every call is bounded by a timeout. A hung AI service must never hold
 *        a FreshCarts request open, because the request is holding a connection
 *        and a shopper's attention.
 *   §37  Failure is always graceful and always local to scanning. Browsing,
 *        search, cart and checkout are unaffected by anything that happens here.
 *   §39  The response is validated before it is believed.
 *   §40  Only a connection failure is retried. A request that WAS delivered is
 *        never repeated: OCR is expensive, and retrying it would double the
 *        cost for the same answer.
 *   §42  Sizes, durations and outcomes are logged. The image is not, and
 *        neither is anything read off it.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/common/config/configuration';
import { BusinessException } from 'src/common/errors';
import {
  AI_ERROR_CODES,
  type AiErrorResponse,
  type AiGroceryListResponse,
} from './ai-ocr.contract';
import { MalformedAiResponseError, validateOcrResponse } from './ai-ocr.validator';

const OCR_PATH = '/api/v1/ocr/grocery-list';
const HEALTH_PATH = '/health';
const REQUEST_ID_HEADER = 'X-Request-Id';

/** A short pause between connection retries, so a restarting service can land. */
const RETRY_DELAY_MS = 250;

export interface ScanRequest {
  image: Buffer;
  filename: string;
  contentType: string;
  /** Correlation id, generated per scan and threaded through all three tiers. */
  requestId: string;
}

@Injectable()
export class AiOcrClient {
  private readonly logger = new Logger(AiOcrClient.name);

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  private get config() {
    return this.configService.get('ai', { infer: true });
  }

  get isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Sends an image to the AI service and returns validated grocery items.
   *
   * Throws only BusinessExceptions — the caller never has to reason about
   * fetch, AbortError or HTTP status codes.
   */
  async readGroceryList(request: ScanRequest): Promise<AiGroceryListResponse> {
    if (!this.isEnabled) {
      this.logger.warn('A scan was requested while the AI service is disabled by configuration');
      throw BusinessException.scanUnavailable();
    }

    const startedAt = Date.now();
    const response = await this.post(request);
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      throw this.translateErrorStatus(response, durationMs, request.requestId);
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      this.logger.error('The AI service returned a body that is not JSON');
      throw BusinessException.scanFailed();
    }

    try {
      const validated = validateOcrResponse(payload);

      this.logger.log(
        'Scan completed [' +
          request.requestId +
          '] items=' +
          validated.items.length +
          ' band=' +
          validated.diagnostics.confidenceBand +
          ' durationMs=' +
          durationMs,
      );

      return validated;
    } catch (error) {
      if (error instanceof MalformedAiResponseError) {
        // §39: malformed output IS an AI service failure. It never reaches the
        // matcher, and certainly never reaches the cart.
        this.logger.error('Malformed AI response [' + request.requestId + ']: ' + error.message);
        throw BusinessException.scanFailed();
      }

      throw error;
    }
  }

  /**
   * Whether the AI service is reachable and has a working OCR engine.
   *
   * Used by the scan screen to hide the feature rather than let a shopper
   * photograph their list and only then be told it cannot be read.
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isEnabled) return false;

    try {
      const response = await fetch(this.config.baseUrl + HEALTH_PATH, {
        // A health probe gets a much shorter budget than a scan: it is answering
        // "should I show a button?", and a slow answer is a no.
        signal: AbortSignal.timeout(Math.min(this.config.timeoutMs, 3_000)),
      });

      if (!response.ok) return false;

      const body = (await response.json()) as { status?: string };
      return body.status === 'ok';
    } catch {
      // Unreachable is simply "not available". Nothing here is worth an error
      // log every time a developer has not started the Python service.
      return false;
    }
  }

  /**
   * Performs the upload, retrying only when the request never left the machine.
   */
  private async post(request: ScanRequest): Promise<Response> {
    const { baseUrl, timeoutMs, connectRetries } = this.config;
    const attempts = Math.max(0, connectRetries) + 1;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const form = new FormData();
      // A fresh Blob per attempt: a body is consumed by the fetch that sends it.
      form.append(
        'image',
        new Blob([new Uint8Array(request.image)], { type: request.contentType }),
        request.filename,
      );

      try {
        return await fetch(baseUrl + OCR_PATH, {
          method: 'POST',
          body: form,
          headers: { [REQUEST_ID_HEADER]: request.requestId },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const isLastAttempt = attempt === attempts;

        if (this.isTimeout(error)) {
          // Never retried. The service received the image and is working on it;
          // sending it again would run OCR twice and still time out.
          this.logger.error(
            'AI service timed out after ' + timeoutMs + 'ms [' + request.requestId + ']',
          );
          throw BusinessException.scanUnavailable();
        }

        if (isLastAttempt) {
          this.logger.error(
            'AI service unreachable at ' +
              baseUrl +
              ' after ' +
              attempts +
              ' attempt(s) [' +
              request.requestId +
              ']',
          );
          throw BusinessException.scanUnavailable();
        }

        // A connection error means nothing was processed, so retrying is free
        // of side effects — the one case where a retry is safe.
        this.logger.warn(
          'AI service connection failed, retrying [' +
            request.requestId +
            '] ' +
            attempt +
            '/' +
            attempts,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    // Unreachable: the loop either returns or throws.
    throw BusinessException.scanUnavailable();
  }

  private isTimeout(error: unknown): boolean {
    return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
  }

  /**
   * Maps an AI service error onto a FreshCarts one.
   *
   * The AI service's own codes are translated rather than forwarded: they are
   * an internal contract, and a shopper-facing error should not change meaning
   * because a Python module was renamed.
   */
  private translateErrorStatus(
    response: Response,
    durationMs: number,
    requestId: string,
  ): BusinessException {
    // Best effort: an error body is useful but never required.
    const bodyPromise: Promise<AiErrorResponse> = response
      .json()
      .then((value) => value as AiErrorResponse)
      .catch(() => ({}));

    // The body is not awaited — this method is synchronous by design so the
    // caller's control flow stays simple. What matters for the decision is the
    // status, and the code refines it only for logging.
    void bodyPromise.then((body) => {
      this.logger.warn(
        'AI service refused a scan [' +
          requestId +
          '] status=' +
          response.status +
          ' code=' +
          (body.code ?? 'unknown') +
          ' durationMs=' +
          durationMs,
      );
    });

    switch (response.status) {
      case 400:
        return BusinessException.imageInvalid(
          'That file is not a photo we can read. Please upload a JPG, PNG or WEBP image.',
        );

      case 413:
        return BusinessException.imageTooLarge(
          this.configService.get('scan', { infer: true }).maxImageBytes,
        );

      case 422:
        return BusinessException.imageUnreadable(
          'The writing on that photo is hard to read. Try taking a clearer picture in good light.',
        );

      case 503:
      case 504:
        // The engine is missing or too slow. Both are ours to fix, not the
        // shopper's, and both mean "try again shortly".
        return BusinessException.scanUnavailable();

      default:
        return BusinessException.scanFailed();
    }
  }
}

/** Re-exported so tests can assert on the codes without a second import path. */
export { AI_ERROR_CODES };

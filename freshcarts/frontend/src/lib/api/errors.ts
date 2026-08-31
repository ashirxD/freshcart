/**
 * Stable business error codes from the API.
 *
 * This is the contract the client branches on. Unlike `message`, which is copy
 * and may be reworded at any time, these are part of the API — the checkout
 * screens key their behaviour off the code and show the server's message.
 */
export type ApiErrorCode =
  | 'CART_EMPTY'
  | 'PRODUCT_UNAVAILABLE'
  | 'INSUFFICIENT_STOCK'
  | 'PRICE_CHANGED'
  | 'CHECKOUT_VALIDATION_FAILED'
  | 'STORE_UNAVAILABLE'
  | 'INVALID_ADDRESS'
  | 'ADDRESS_COORDINATES_REQUIRED'
  | 'DELIVERY_UNAVAILABLE'
  | 'DELIVERY_PRICING_UNAVAILABLE'
  | 'ROUTING_UNAVAILABLE'
  | 'PAYMENT_METHOD_UNSUPPORTED'
  | 'ORDER_CREATION_FAILED'
  | 'ORDER_NOT_CANCELLABLE'
  | 'INVALID_STATUS_TRANSITION'
  // Grocery-list scanning. Each one maps to a different screen, which is the
  // reason they are separate codes rather than one "scan failed".
  | 'IMAGE_INVALID'
  | 'IMAGE_TOO_LARGE'
  | 'IMAGE_UNREADABLE'
  | 'SCAN_UNAVAILABLE'
  | 'SCAN_FAILED'
  | 'DUPLICATE_REQUEST';

/** Normalised error for every failed API call. Mirrors the backend error shape. */
export class ApiError extends Error {
  readonly status: number;
  readonly details: string[];
  /** Present only on business failures; framework errors carry no code. */
  readonly code?: ApiErrorCode;
  /**
   * Structured context for the code — the changed lines, the distance that was
   * too far. Typed at the point of use, because its shape depends on the code.
   */
  readonly context?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    details: string[] = [],
    code?: ApiErrorCode,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.code = code;
    this.context = context;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isValidationError(): boolean {
    return this.status === 400 || this.status === 422;
  }

  /** A lost connection rather than a rejected request. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** Narrows `context` for a caller that has already checked `code`. */
  contextAs<T>(): T | undefined {
    return this.context as T | undefined;
  }
}

interface ApiErrorBody {
  message?: string | string[];
  error?: string;
  code?: ApiErrorCode;
  details?: Record<string, unknown>;
}

/**
 * Turns the backend error payload into an ApiError.
 *
 * The server's message is used as-is for business failures: it was written for
 * a shopper, it names the specific product or address involved, and rewriting
 * it here would produce something vaguer from strictly less information.
 */
export function toApiError(status: number, body: unknown): ApiError {
  const payload = (body ?? {}) as ApiErrorBody;
  const messages = Array.isArray(payload.message)
    ? payload.message
    : payload.message
      ? [payload.message]
      : [];

  const message = messages[0] ?? payload.error ?? 'Something went wrong. Please try again.';

  return new ApiError(status, message, messages, payload.code, payload.details);
}

/**
 * A network or CORS failure, which `fetch` reports by rejecting rather than by
 * returning a status. Given status 0 so callers can tell it apart from a
 * response the server actually sent.
 */
export function toNetworkError(): ApiError {
  return new ApiError(
    0,
    'We could not reach FreshCarts. Please check your connection and try again.',
  );
}

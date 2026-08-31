/**
 * Machine-readable business error codes.
 *
 * These travel in the `code` field of every error response and are part of the
 * public API contract: the web client maps them to shopper-facing copy, so
 * renaming one is a breaking change. The human `message` beside them may be
 * reworded freely — that is exactly why the code exists.
 *
 * Only *business* outcomes belong here. Framework failures (malformed JSON, a
 * failed DTO rule, an expired token) already have accurate HTTP semantics and
 * need no second vocabulary.
 */
export enum ErrorCode {
  // --- Checkout preconditions -------------------------------------------
  CART_EMPTY = 'CART_EMPTY',
  PRODUCT_UNAVAILABLE = 'PRODUCT_UNAVAILABLE',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  PRICE_CHANGED = 'PRICE_CHANGED',
  CHECKOUT_VALIDATION_FAILED = 'CHECKOUT_VALIDATION_FAILED',
  STORE_UNAVAILABLE = 'STORE_UNAVAILABLE',

  // --- Delivery ----------------------------------------------------------
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  ADDRESS_COORDINATES_REQUIRED = 'ADDRESS_COORDINATES_REQUIRED',
  DELIVERY_UNAVAILABLE = 'DELIVERY_UNAVAILABLE',
  DELIVERY_PRICING_UNAVAILABLE = 'DELIVERY_PRICING_UNAVAILABLE',
  ROUTING_UNAVAILABLE = 'ROUTING_UNAVAILABLE',

  // --- Payment -----------------------------------------------------------
  PAYMENT_METHOD_UNSUPPORTED = 'PAYMENT_METHOD_UNSUPPORTED',

  // --- Orders ------------------------------------------------------------
  ORDER_CREATION_FAILED = 'ORDER_CREATION_FAILED',
  ORDER_NOT_CANCELLABLE = 'ORDER_NOT_CANCELLABLE',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',

  // --- Grocery-list scanning ---------------------------------------------
  /** The upload is not a supported image, or is not an image at all. */
  IMAGE_INVALID = 'IMAGE_INVALID',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  /** Decodable, but nothing on it could be read. "Take a clearer photo." */
  IMAGE_UNREADABLE = 'IMAGE_UNREADABLE',
  /** The AI service is offline, timed out, or has no OCR engine installed. */
  SCAN_UNAVAILABLE = 'SCAN_UNAVAILABLE',
  /** It answered, but with something this API will not pass to the cart. */
  SCAN_FAILED = 'SCAN_FAILED',

  // --- Store operations --------------------------------------------------
  /** A STORE_MANAGER account exists but is not bound to any store. */
  STORE_NOT_ASSIGNED = 'STORE_NOT_ASSIGNED',

  // --- Substitutions -----------------------------------------------------
  /** The proposal does not describe a valid swap (wrong line, same product, ...). */
  SUBSTITUTION_INVALID = 'SUBSTITUTION_INVALID',
  /** A proposal for this line is already open and must be resolved first. */
  SUBSTITUTION_ALREADY_OPEN = 'SUBSTITUTION_ALREADY_OPEN',
  /** The replacement would cost the shopper more than they agreed to pay. */
  SUBSTITUTION_PRICE_INCREASE = 'SUBSTITUTION_PRICE_INCREASE',
  /** The replacement is inactive, or there is not enough of it to set aside. */
  SUBSTITUTION_REPLACEMENT_UNAVAILABLE = 'SUBSTITUTION_REPLACEMENT_UNAVAILABLE',
  /** The order has moved past the point where its lines may still be changed. */
  SUBSTITUTION_ORDER_NOT_EDITABLE = 'SUBSTITUTION_ORDER_NOT_EDITABLE',

  // --- Request handling --------------------------------------------------
  DUPLICATE_REQUEST = 'DUPLICATE_REQUEST',
}

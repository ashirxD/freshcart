import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-code.enum';

/** The short reason phrase clients already see on framework errors. */
function statusText(status: HttpStatus): string {
  return (
    {
      [HttpStatus.BAD_REQUEST]: 'Bad Request',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not Found',
      [HttpStatus.CONFLICT]: 'Conflict',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
    }[status as number] ?? 'Error'
  );
}

/**
 * Extra, structured context for a business failure.
 *
 * Deliberately loose in shape but strict in intent: it carries only what the
 * client needs to *act* — which line changed price, how many units are left —
 * never internals such as query filters, stack frames or database ids the
 * shopper has no business seeing.
 */
export type BusinessErrorDetails = Record<string, unknown>;

/**
 * A failure the shopper can understand and usually fix.
 *
 * Every one of these carries three things: an HTTP status so infrastructure
 * behaves correctly, a stable {@link ErrorCode} the client can branch on, and a
 * message written for a person. The `details` payload is optional structured
 * context — the changed lines, the remaining stock — so the UI can render a
 * useful screen instead of a bare sentence.
 */
export class BusinessException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: BusinessErrorDetails;

  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.CONFLICT,
    details?: BusinessErrorDetails,
  ) {
    // The payload shape matches what AllExceptionsFilter already reads, so a
    // BusinessException renders through exactly the same path as any other
    // HttpException — there is no second error format in the application.
    super({ message, error: statusText(status), code, details }, status);
    this.code = code;
    this.details = details;
  }

  // --- Named constructors -------------------------------------------------
  // One per situation, so the status/code/message triple is decided once and
  // cannot drift between the places that raise the same failure.

  static cartEmpty(): BusinessException {
    return new BusinessException(
      ErrorCode.CART_EMPTY,
      'Your cart is empty. Add something to it before checking out.',
      HttpStatus.BAD_REQUEST,
    );
  }

  static checkoutValidationFailed(
    message: string,
    details: BusinessErrorDetails,
  ): BusinessException {
    return new BusinessException(
      ErrorCode.CHECKOUT_VALIDATION_FAILED,
      message,
      HttpStatus.CONFLICT,
      details,
    );
  }

  static storeUnavailable(message: string): BusinessException {
    return new BusinessException(ErrorCode.STORE_UNAVAILABLE, message, HttpStatus.CONFLICT);
  }

  static invalidAddress(message: string): BusinessException {
    return new BusinessException(ErrorCode.INVALID_ADDRESS, message, HttpStatus.BAD_REQUEST);
  }

  static addressCoordinatesRequired(): BusinessException {
    return new BusinessException(
      ErrorCode.ADDRESS_COORDINATES_REQUIRED,
      'This address has no map location yet, so we cannot work out the delivery distance. Please edit it and set the location.',
      HttpStatus.BAD_REQUEST,
    );
  }

  static deliveryUnavailable(message: string, details?: BusinessErrorDetails): BusinessException {
    return new BusinessException(
      ErrorCode.DELIVERY_UNAVAILABLE,
      message,
      HttpStatus.CONFLICT,
      details,
    );
  }

  static deliveryPricingUnavailable(): BusinessException {
    return new BusinessException(
      ErrorCode.DELIVERY_PRICING_UNAVAILABLE,
      'We could not work out a delivery charge for your address right now. Please try pickup, or try again shortly.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  static routingUnavailable(): BusinessException {
    return new BusinessException(
      ErrorCode.ROUTING_UNAVAILABLE,
      'We could not measure the distance to your address right now. Please try again in a moment.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  static paymentMethodUnsupported(method: string): BusinessException {
    return new BusinessException(
      ErrorCode.PAYMENT_METHOD_UNSUPPORTED,
      '"' + method + '" is not available yet. Please choose another payment method.',
      HttpStatus.BAD_REQUEST,
    );
  }

  static orderCreationFailed(): BusinessException {
    return new BusinessException(
      ErrorCode.ORDER_CREATION_FAILED,
      'We could not place your order. Nothing has been charged and your cart is unchanged — please try again.',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  static orderNotCancellable(message: string): BusinessException {
    return new BusinessException(ErrorCode.ORDER_NOT_CANCELLABLE, message, HttpStatus.CONFLICT);
  }

  static invalidStatusTransition(from: string, to: string): BusinessException {
    return new BusinessException(
      ErrorCode.INVALID_STATUS_TRANSITION,
      'An order cannot move from ' + from + ' to ' + to + '.',
      HttpStatus.CONFLICT,
    );
  }

  // --- Grocery-list scanning ---------------------------------------------

  static imageInvalid(message: string): BusinessException {
    return new BusinessException(ErrorCode.IMAGE_INVALID, message, HttpStatus.BAD_REQUEST);
  }

  static imageTooLarge(maxBytes: number): BusinessException {
    return new BusinessException(
      ErrorCode.IMAGE_TOO_LARGE,
      'That photo is too large. Please use one under ' +
        Math.round(maxBytes / (1024 * 1024)) +
        ' MB.',
      HttpStatus.PAYLOAD_TOO_LARGE,
      { maxBytes },
    );
  }

  static imageUnreadable(message: string): BusinessException {
    return new BusinessException(
      ErrorCode.IMAGE_UNREADABLE,
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  /**
   * Scanning is unavailable, for any reason the shopper cannot act on.
   *
   * One message for every cause on purpose: "the AI service is offline",
   * "the request timed out" and "no OCR engine is installed" are all the same
   * fact to a shopper, and naming the internals would tell an attacker about
   * our topology while helping nobody (section 36).
   */
  static scanUnavailable(): BusinessException {
    return new BusinessException(
      ErrorCode.SCAN_UNAVAILABLE,
      'We could not read your list right now. Please try again in a moment, or add items by searching.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  static scanFailed(): BusinessException {
    return new BusinessException(
      ErrorCode.SCAN_FAILED,
      'Something went wrong while reading your list. Please try again with another photo.',
      HttpStatus.BAD_GATEWAY,
    );
  }

  // --- Store operations ---------------------------------------------------

  /**
   * A store manager with no store binding.
   *
   * Unreachable through the normal role flow — the User schema refuses to save a
   * STORE_MANAGER without a `storeId`, and UsersService requires one when
   * promoting. It exists because "no store" must fail closed rather than
   * silently fall back to the default store, which would hand a manager the
   * wrong shop's orders.
   */
  static storeNotAssigned(): BusinessException {
    return new BusinessException(
      ErrorCode.STORE_NOT_ASSIGNED,
      'Your account is not linked to a store yet. Please ask an administrator to assign one.',
      HttpStatus.FORBIDDEN,
    );
  }

  // --- Substitutions ------------------------------------------------------

  static substitutionInvalid(message: string): BusinessException {
    return new BusinessException(ErrorCode.SUBSTITUTION_INVALID, message, HttpStatus.BAD_REQUEST);
  }

  static substitutionAlreadyOpen(productName: string): BusinessException {
    return new BusinessException(
      ErrorCode.SUBSTITUTION_ALREADY_OPEN,
      'There is already a replacement waiting for the customer to answer on "' +
        productName +
        '". Cancel that one first.',
      HttpStatus.CONFLICT,
    );
  }

  /**
   * The replacement costs more than the original line.
   *
   * Refused outright rather than offered as an upcharge: the shopper agreed to a
   * total, and a substitution is not an opportunity to revise it. See
   * SubstitutionsService for the full price rule.
   */
  static substitutionPriceIncrease(details: BusinessErrorDetails): BusinessException {
    return new BusinessException(
      ErrorCode.SUBSTITUTION_PRICE_INCREASE,
      'That replacement costs more than the item it replaces. Choose one at the same price or less, or reject the order.',
      HttpStatus.CONFLICT,
      details,
    );
  }

  static substitutionReplacementUnavailable(message: string): BusinessException {
    return new BusinessException(
      ErrorCode.SUBSTITUTION_REPLACEMENT_UNAVAILABLE,
      message,
      HttpStatus.CONFLICT,
    );
  }

  static substitutionOrderNotEditable(status: string): BusinessException {
    return new BusinessException(
      ErrorCode.SUBSTITUTION_ORDER_NOT_EDITABLE,
      'This order is ' + status.toLowerCase() + ', so its items can no longer be changed.',
      HttpStatus.CONFLICT,
    );
  }

  static duplicateRequest(): BusinessException {
    return new BusinessException(
      ErrorCode.DUPLICATE_REQUEST,
      'That order is already being placed. Please wait a moment before trying again.',
      HttpStatus.CONFLICT,
    );
  }
}

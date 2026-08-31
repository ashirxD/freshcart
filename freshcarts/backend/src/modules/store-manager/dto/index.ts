import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { OrderStatus } from 'src/modules/orders';

/**
 * A status advance requested by store staff.
 *
 * The target status is the *only* thing a client sends. Whether the order may go
 * there is decided by the state machine against the order's own current status
 * and fulfilment method — so this DTO validating "is this a real status" is
 * shape checking, not authorization, and the two must not be confused.
 *
 * Note the deliberate absence of `changedBy`. Attribution comes from the
 * verified JWT principal (§54); an audit trail a client can author is not one.
 */
export class UpdateStoreOrderStatusDto {
  @IsEnum(OrderStatus, { message: 'status must be a valid order status' })
  status: OrderStatus;

  /**
   * Required by the service for a rejection, cancellation or failure — the
   * shopper reads it in their timeline, and "no reason given" is not acceptable
   * for an order the store is refusing.
   */
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Please give a short reason' })
  @MaxLength(300)
  reason?: string;
}

/** Preset rejection reasons (§19/§44), plus a free-text note. */
export enum OrderRejectionReason {
  UNABLE_TO_FULFILL = 'UNABLE_TO_FULFILL',
  ITEMS_UNAVAILABLE = 'ITEMS_UNAVAILABLE',
  STORE_CLOSED = 'STORE_CLOSED',
  OTHER = 'OTHER',
}

/** Shopper-facing wording for each preset. Composed server-side, never client-side. */
export const REJECTION_REASON_TEXT: Record<OrderRejectionReason, string> = {
  [OrderRejectionReason.UNABLE_TO_FULFILL]: 'The store could not fulfil this order.',
  [OrderRejectionReason.ITEMS_UNAVAILABLE]: 'Some items in this order are unavailable.',
  [OrderRejectionReason.STORE_CLOSED]: 'The store was closed and could not take this order.',
  [OrderRejectionReason.OTHER]: 'The store could not accept this order.',
};

export class RejectStoreOrderDto {
  @IsEnum(OrderRejectionReason, { message: 'reason must be one of the listed rejection reasons' })
  reason: OrderRejectionReason;

  /** Optional detail, appended to the preset sentence the shopper sees. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class UpdateProductAvailabilityDto {
  @IsEnum(['AVAILABLE', 'UNAVAILABLE'], {
    message: 'availability must be AVAILABLE or UNAVAILABLE',
  })
  availability: 'AVAILABLE' | 'UNAVAILABLE';
}

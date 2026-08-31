import { IsEnum, IsMongoId, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { PaymentMethod } from 'src/modules/payments/enums';
import { FulfillmentMethod } from 'src/modules/orders/order-status.machine';

/**
 * Everything a client is allowed to say about a checkout.
 *
 * Read the field list as the security boundary it is. There is no `items`, no
 * `subtotal`, no `deliveryFee`, no `total`, no `price`, no `distance`, no
 * `status`. Those are not omitted for brevity — they are the values §1 and §60
 * forbid trusting, and the way to make them untrustable is to give them nowhere
 * to arrive. `whitelist: true` with `forbidNonWhitelisted: true` (main.ts) then
 * rejects the request outright if a client sends one anyway.
 *
 * What the server accepts is a choice of fulfilment, an address the caller must
 * own, a payment method that must be enabled, and a note. Everything else it
 * looks up.
 */
export class CheckoutPreviewDto {
  @IsEnum(FulfillmentMethod, { message: 'Choose either delivery or pickup' })
  fulfillmentMethod: FulfillmentMethod;

  /**
   * Required for delivery, forbidden for pickup.
   *
   * `ValidateIf` rather than plain `@IsOptional()` so that omitting it on a
   * delivery order is a clear validation error instead of surfacing later as a
   * confusing business failure.
   */
  @ValidateIf((dto: CheckoutPreviewDto) => dto.fulfillmentMethod === FulfillmentMethod.DELIVERY)
  @IsMongoId({ message: 'Choose a delivery address' })
  addressId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'Choose a valid payment method' })
  paymentMethod?: PaymentMethod;
}

/** What POST /orders accepts. The payment method stops being optional. */
export class CreateOrderDto {
  @IsEnum(FulfillmentMethod, { message: 'Choose either delivery or pickup' })
  fulfillmentMethod: FulfillmentMethod;

  @ValidateIf((dto: CreateOrderDto) => dto.fulfillmentMethod === FulfillmentMethod.DELIVERY)
  @IsMongoId({ message: 'Choose a delivery address' })
  addressId?: string;

  @IsEnum(PaymentMethod, { message: 'Choose a payment method' })
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Please keep your note under 500 characters' })
  customerNote?: string;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Please keep the reason under 300 characters' })
  reason?: string;
}

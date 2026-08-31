import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto';
import { FulfillmentMethod, OrderStatus } from '../order-status.machine';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

/**
 * The store order queue's filters.
 *
 * Note the absence of `storeId`. It is never accepted from a request — the scope
 * is resolved from the authenticated principal, so there is no parameter a
 * manager could change to see another shop's queue. §3.
 *
 * Paginated by inheritance, so the queue is always bounded (§67).
 */
export class QueryStoreOrdersDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'status must be a valid order status' })
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(FulfillmentMethod, { message: 'fulfillmentMethod must be DELIVERY or PICKUP' })
  fulfillmentMethod?: FulfillmentMethod;

  /**
   * Only orders the store is holding up: pending, confirmed, preparing, packed.
   * The dashboard's "needs your attention" list is this filter.
   */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  needsAction?: boolean;

  /** Orders placed on or after this instant. */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'placedFrom must be a valid date' })
  placedFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'placedTo must be a valid date' })
  placedTo?: Date;

  /**
   * Order number lookup — the one thing staff search by, because it is what a
   * customer reads out on the phone. Matched as a case-insensitive prefix so a
   * partial number still finds the order.
   */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  orderNumber?: string;
}

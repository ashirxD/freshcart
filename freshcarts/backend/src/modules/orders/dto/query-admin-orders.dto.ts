import { Transform } from 'class-transformer';
import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { QueryStoreOrdersDto } from './query-store-orders.dto';

/**
 * The admin order queue's filters.
 *
 * Everything the store queue accepts, plus the two dimensions that only make
 * sense above a single store: which store, and which customer.
 *
 * `storeId` IS accepted here, unlike on the store surface — and that is safe
 * for exactly one reason: the route carrying this DTO is ADMIN-only, and an
 * admin's legitimate scope is every store. It is still validated as an ObjectId
 * and still lands in the query filter rather than being compared afterwards.
 * Nothing else in FreshCarts accepts a store id from a request (section 12).
 */
export class QueryAdminOrdersDto extends QueryStoreOrdersDto {
  @IsOptional()
  @IsMongoId({ message: 'storeId must be a valid store id' })
  storeId?: string;

  /**
   * Free-text match on the shopper's name or phone. Resolved to a bounded set
   * of user ids before it touches the order collection — orders hold no
   * customer name to match against, by design.
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  customer?: string;
}

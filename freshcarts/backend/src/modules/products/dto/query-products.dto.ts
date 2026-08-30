import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto';
import { MAX_PRICE_PKR } from '../schemas';

/**
 * Sort options the data can actually support.
 *
 * There is deliberately no "Most popular": nothing in the system records sales
 * or views yet, so the option would be a lie dressed as a feature. It arrives
 * with order history.
 */
export enum ProductSort {
  RELEVANCE = 'relevance',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NEWEST = 'newest',
  DISCOUNT = 'discount',
  NAME_ASC = 'name_asc',
}

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

/**
 * One query DTO for the whole catalogue, rather than an endpoint per filter.
 * Everything here is optional and independently combinable.
 */
export class QueryProductsDto extends PaginationQueryDto {
  /** Free text over name, brand and searchTerms; also matches an exact SKU/barcode. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  /** Category id or slug. A top-level category also matches its subcategories. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subcategory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  brand?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_PKR)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_PKR)
  maxPrice?: number;

  /** Only products a shopper can actually buy right now. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  inStock?: boolean;

  /** Only products with a genuine compare-at price above the selling price. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  discounted?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsEnum(ProductSort)
  sort?: ProductSort;

  /**
   * Admin-only; ignored for customers by the controller. Lets the back office
   * list deactivated products without a parallel set of endpoints.
   */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeInactive?: boolean;
}

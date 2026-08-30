import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto';

/**
 * Stock adjustment. Exactly one of `quantity` (absolute) or `adjustBy`
 * (relative) may be sent — the service rejects both together, because "set to
 * 50" and "add 50" are very different instructions to get confused about.
 */
export class UpdateInventoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  quantity?: number;

  /** Relative change: +12 on a delivery, -3 on a damaged unit. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  adjustBy?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  lowStockThreshold?: number;

  /** Short note for the audit log, e.g. "delivery 2026-08-30". Never persisted PII. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;
}

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

export class QueryInventoryDto extends PaginationQueryDto {
  /** Free-text match on product name or SKU. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  /** Narrows to items at or below their low-stock threshold. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  lowStockOnly?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  outOfStockOnly?: boolean;
}

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
import { StockStatus } from 'src/common/enums';
import { StockChangeReason } from '../schemas';

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

  /**
   * Why the stock moved, from a controlled list. Recorded on the audit row so
   * "how much did we write off as damaged?" is answerable; free text alone
   * would not be.
   */
  @IsOptional()
  @IsEnum(StockChangeReason, { message: 'changeReason must be a supported stock reason' })
  changeReason?: StockChangeReason;
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

  /**
   * The availability band to show. Preferred over the two booleans below, which
   * predate it and are kept so the existing admin screen keeps working.
   */
  @IsOptional()
  @IsEnum(StockStatus, { message: 'status must be IN_STOCK, LOW_STOCK or OUT_OF_STOCK' })
  status?: StockStatus;

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

import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Base query DTO for every paginated list endpoint. */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function paginated<T>(
  items: T[],
  total: number,
  options: { page: number; limit: number },
): PaginatedResult<T> {
  return {
    items,
    meta: {
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.max(1, Math.ceil(total / options.limit)),
    },
  };
}

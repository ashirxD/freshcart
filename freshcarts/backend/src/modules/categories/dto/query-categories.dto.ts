import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** `?flag=true` arrives as a string; normalise it before @IsBoolean runs. */
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

export class QueryCategoriesDto {
  /**
   * Scope the result to one branch of the tree, by parent id or parent slug.
   * Omitted returns the whole tree.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  parent?: string;

  /**
   * Flattens the response to a plain array instead of nesting children.
   * Admin screens want the flat form; the storefront wants the tree.
   */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  flat?: boolean;

  /** Adds an active-product count per category. Costs one extra aggregation. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  withProductCount?: boolean;

  /**
   * Admin-only. Silently ignored for customers by the controller, so a shopper
   * cannot reveal a hidden category by guessing the parameter.
   */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeInactive?: boolean;
}

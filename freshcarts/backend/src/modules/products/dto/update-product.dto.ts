import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsBoolean } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

/**
 * Opening stock belongs to product *creation* only. Later stock changes go
 * through the inventory endpoints, so there is exactly one path that writes a
 * quantity and one place its rules live.
 */
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['initialQuantity', 'lowStockThreshold'] as const),
) {}

export class UpdateProductStatusDto {
  @IsBoolean()
  isActive: boolean;
}

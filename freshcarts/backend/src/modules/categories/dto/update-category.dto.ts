import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsMongoId, Max, Min, ValidateNested } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';

/**
 * Every creation field, all optional. Uniqueness, parent validity and cycle
 * checks are re-run by the service — this only covers shape.
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class ReorderCategoryEntryDto {
  @IsMongoId()
  id: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  displayOrder: number;
}

/**
 * Reordering is one request, not one per category: a drag-and-drop reorder
 * changes several positions at once and must not leave the list half-applied.
 */
export class ReorderCategoriesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReorderCategoryEntryDto)
  categories: ReorderCategoryEntryDto[];
}

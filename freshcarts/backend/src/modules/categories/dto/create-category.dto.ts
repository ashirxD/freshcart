import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SLUG_PATTERN } from 'src/common/utils';
import { IMAGE_URL_PATTERN } from 'src/modules/products/dto';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  /**
   * Optional hint only. The service always runs it through `slugify` and
   * de-duplicates, so a client can never dictate the stored value.
   */
  @IsOptional()
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase words separated by hyphens' })
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  /** An uploaded path or an http(s) URL — see IMAGE_URL_PATTERN. */
  @IsOptional()
  @IsString()
  @Matches(IMAGE_URL_PATTERN, {
    message: 'The image must be an uploaded path or an http(s) URL',
  })
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  /** Null or omitted creates a top-level category. */
  @IsOptional()
  @IsMongoId({ message: 'parentId must be a valid category id' })
  parentId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

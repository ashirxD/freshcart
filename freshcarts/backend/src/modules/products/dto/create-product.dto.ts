import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { UnitType } from 'src/common/enums';
import { SLUG_PATTERN } from 'src/common/utils';
import { MAX_PRICE_PKR } from '../schemas';

export class ProductImageDto {
  @IsUrl({ require_tld: false }, { message: 'Each image needs a valid URL' })
  @MaxLength(600)
  url: string;

  /** Mandatory: an image with no alt text is invisible to a screen reader. */
  @IsString()
  @IsNotEmpty({ message: 'Each image needs alt text describing the product' })
  @MaxLength(160)
  alt: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  sortOrder?: number;
}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  /** Hint only — the service slugifies and de-duplicates before persisting. */
  @IsOptional()
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase words separated by hyphens' })
  @MaxLength(180)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsMongoId({ message: 'categoryId must be a valid category id' })
  categoryId: string;

  @IsOptional()
  @IsMongoId({ message: 'subcategoryId must be a valid category id' })
  subcategoryId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  /** Whole rupees. Integer by design — see MAX_PRICE_PKR in the schema. */
  @Type(() => Number)
  @IsInt({ message: 'sellingPrice must be a whole number of rupees' })
  @Min(1)
  @Max(MAX_PRICE_PKR)
  sellingPrice: number;

  /** Omit or null when the product is not discounted. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'compareAtPrice must be a whole number of rupees' })
  @Min(1)
  @Max(MAX_PRICE_PKR)
  compareAtPrice?: number | null;

  @IsEnum(UnitType, { message: 'unitType must be one of the supported grocery units' })
  unitType: UnitType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(100_000)
  unitValue: number;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9-]*$/, {
    message: 'sku may contain letters, digits and hyphens only',
  })
  @MaxLength(40)
  sku: string;

  @IsOptional()
  @Matches(/^[0-9]{6,32}$/, { message: 'barcode must be 6-32 digits' })
  barcode?: string;

  /**
   * Urdu / Roman-Urdu names and common misspellings, so "doodh" finds milk.
   * Optional: most products are found by their English name alone.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  searchTerms?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  /** Opening stock. Creates the product's inventory row in the same request. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  initialQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  lowStockThreshold?: number;
}

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  Max,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SLUG_PATTERN } from 'src/common/utils';
import { TIME_OF_DAY_PATTERN } from '../schemas';

export class StoreAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  line1: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  line2?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  area: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  postalCode?: string;
}

/** Accepted in human order (lat, lng) and converted to GeoJSON by the service. */
export class CoordinatesDto {
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @Type(() => Number)
  @IsLongitude()
  longitude: number;
}

export class OpeningHoursDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  day: number;

  @Matches(TIME_OF_DAY_PATTERN, { message: 'opensAt must be a 24-hour time such as 08:00' })
  opensAt: string;

  @Matches(TIME_OF_DAY_PATTERN, { message: 'closesAt must be a 24-hour time such as 23:00' })
  closesAt: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}

export class CreateStoreDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  /** Optional: the service derives a deterministic slug from the name when absent. */
  @IsOptional()
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase words separated by hyphens' })
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @ValidateNested()
  @Type(() => StoreAddressDto)
  address: StoreAddressDto;

  @ValidateNested()
  @Type(() => CoordinatesDto)
  location: CoordinatesDto;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OpeningHoursDto)
  openingHours?: OpeningHoursDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

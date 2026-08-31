import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { PK_MOBILE_E164 } from 'src/common/utils';
import { AddressLabel } from '../schemas';

/**
 * Note what a client cannot send: `userId`. Ownership is taken from the
 * verified JWT principal in the controller, so there is no field here through
 * which one shopper could file an address under another's account.
 */
export class CreateAddressDto {
  @IsOptional()
  @IsEnum(AddressLabel, { message: 'label must be HOME, WORK or OTHER' })
  label?: AddressLabel;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  nickname?: string;

  @IsString()
  @MinLength(2, { message: 'Please enter who should receive the order' })
  @MaxLength(80)
  recipientName: string;

  @Matches(PK_MOBILE_E164, {
    message: 'Enter a valid Pakistani mobile number, e.g. +923001234567',
  })
  phone: string;

  @IsString()
  @IsNotEmpty({ message: 'House, flat or shop number is required' })
  @MaxLength(60)
  houseNumber: string;

  @IsString()
  @IsNotEmpty({ message: 'Street is required' })
  @MaxLength(120)
  street: string;

  @IsString()
  @IsNotEmpty({ message: 'Area is required' })
  @MaxLength(100)
  area: string;

  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  @MaxLength(80)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  landmark?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  deliveryInstructions?: string;

  /**
   * Optional, but paired: `ValidateIf` makes each half required as soon as the
   * other is present, so a partial coordinate is rejected at the edge rather
   * than by the schema hook.
   */
  @ValidateIf((dto: CreateAddressDto) => dto.latitude !== undefined || dto.longitude !== undefined)
  @Type(() => Number)
  @IsLatitude({ message: 'latitude must be a valid coordinate' })
  latitude?: number;

  @ValidateIf((dto: CreateAddressDto) => dto.latitude !== undefined || dto.longitude !== undefined)
  @Type(() => Number)
  @IsLongitude({ message: 'longitude must be a valid coordinate' })
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Language } from 'src/common/enums';
import { PK_MOBILE_E164, normalisePkPhone } from 'src/common/utils';

export class RegisterDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(2, 80, { message: 'Please enter your full name' })
  fullName: string;

  /**
   * Accepts 03001234567, 923001234567 or +923001234567 and stores one canonical
   * form. Shoppers should not have to know what E.164 is.
   */
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? normalisePkPhone(value) : value))
  @Matches(PK_MOBILE_E164, { message: 'Enter a valid Pakistani mobile number, e.g. 03001234567' })
  phone: string;

  @IsString()
  @Length(8, 72, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Za-z]/, { message: 'Password must contain at least one letter' })
  @Matches(/\d/, { message: 'Password must contain at least one number' })
  password: string;

  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email address' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @IsOptional()
  @IsEnum(Language)
  preferredLanguage?: Language;
}

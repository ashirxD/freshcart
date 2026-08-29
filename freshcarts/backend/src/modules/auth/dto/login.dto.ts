import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PK_MOBILE_E164, normalisePkPhone } from 'src/common/utils';

export class LoginDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? normalisePkPhone(value) : value))
  @Matches(PK_MOBILE_E164, { message: 'Enter a valid Pakistani mobile number' })
  phone: string;

  @IsString()
  @MinLength(1, { message: 'Password is required' })
  @MaxLength(72)
  password: string;
}

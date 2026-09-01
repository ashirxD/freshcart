import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto';
import { PK_MOBILE_E164, normalisePkPhone } from 'src/common/utils';
import { MAX_DELIVERY_FEE_PKR } from 'src/modules/delivery/schemas';
import { OrderStatus } from 'src/modules/orders';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

// --- Customers -----------------------------------------------------------

export class QueryCustomersDto extends PaginationQueryDto {
  /** Free-text match on name, phone or email. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trim)
  search?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Activate or deactivate an account.
 *
 * Deliberately the only write an admin has on a customer. There is no field
 * here for a role, a phone number or a password: a customer's account is
 * theirs, and section 8 rules out impersonation entirely for this milestone.
 */
export class SetAccountStatusDto {
  @IsBoolean()
  isActive: boolean;
}

// --- Store managers ------------------------------------------------------

export class QueryStoreManagersDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trim)
  search?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsMongoId({ message: 'storeId must be a valid store id' })
  storeId?: string;
}

/**
 * Creates a staff account.
 *
 * `storeId` is required, not optional: a manager with no store binding is
 * locked out of every store route by `resolveManagerStoreId`, so creating one
 * would produce an account that appears to work and cannot. The password is
 * hashed by the same PasswordService the registration flow uses — there is no
 * second credential path in FreshCarts (section 10).
 */
export class CreateStoreManagerDto {
  @IsString()
  @Transform(trim)
  @Length(2, 80)
  fullName: string;

  /** Same three accepted forms as customer registration, same canonical store. */
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? normalisePkPhone(value) : value))
  @Matches(PK_MOBILE_E164, { message: 'Enter a valid Pakistani mobile number, e.g. 03001234567' })
  phone: string;

  @IsOptional()
  @IsEmail({}, { message: 'A valid email address is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  /**
   * The same strength rule as customer registration — restated rather than
   * relaxed, because a staff credential protects more than a shopper's does.
   * Never logged, never returned, never recorded in an audit row.
   */
  @IsString()
  @Length(8, 72, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Za-z]/, { message: 'Password must contain at least one letter' })
  @Matches(/\d/, { message: 'Password must contain at least one number' })
  password: string;

  @IsMongoId({ message: 'Choose the store this manager will run' })
  storeId: string;
}

/**
 * Edits a staff account.
 *
 * A password change is deliberately absent: resetting somebody else's
 * credential is a different operation with different consequences, and folding
 * it into a general edit form is how it gets done by accident.
 */
export class UpdateStoreManagerDto {
  @IsOptional()
  @IsString()
  @Transform(trim)
  @Length(2, 80)
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'A valid email address is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  /** Reassigning a manager to a different store. */
  @IsOptional()
  @IsMongoId({ message: 'storeId must be a valid store id' })
  storeId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// --- Orders --------------------------------------------------------------

/**
 * An admin status override.
 *
 * The reason is required and is not optional at any status, unlike the store
 * surface where it is required only for terminal states. See
 * `OrdersService.overrideStatusForAdmin` for why.
 */
export class OverrideOrderStatusDto {
  @IsEnum(OrderStatus, { message: 'status must be a valid order status' })
  status: OrderStatus;

  @IsString()
  @IsNotEmpty({ message: 'Say why you are overriding this order' })
  @Transform(trim)
  @Length(3, 300)
  reason: string;
}

// --- Delivery pricing ----------------------------------------------------

/**
 * One distance band.
 *
 * The bounds are half-open, `[min, max)`, matching the schema and the engine.
 * Validation here is the first of three layers: this DTO rejects negatives and
 * absurd values, the service refuses overlaps with existing active bands, and
 * the schema's pre-validate hook refuses an inverted range whatever route the
 * write arrives by.
 */
export class CreateDeliveryRuleDto {
  @IsString()
  @Transform(trim)
  @Length(2, 60)
  label: string;

  @Type(() => Number)
  @IsInt({ message: 'The lower distance must be a whole number of metres' })
  @Min(0, { message: 'Distance cannot be negative' })
  @Max(1_000_000)
  minDistanceMeters: number;

  @Type(() => Number)
  @IsInt({ message: 'The upper distance must be a whole number of metres' })
  @Min(1, { message: 'The upper distance must be greater than zero' })
  @Max(1_000_000)
  maxDistanceMeters: number;

  @Type(() => Number)
  @IsInt({ message: 'The fee must be a whole number of rupees' })
  @Min(0, { message: 'A delivery fee cannot be negative' })
  @Max(MAX_DELIVERY_FEE_PKR)
  fee: number;

  /** Tie-break for overlapping active bands. Higher wins. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1000)
  @Max(1000)
  priority: number = 0;

  @IsOptional()
  @IsBoolean()
  isActive: boolean = true;
}

export class UpdateDeliveryRuleDto {
  @IsOptional()
  @IsString()
  @Transform(trim)
  @Length(2, 60)
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'Distance cannot be negative' })
  @Max(1_000_000)
  minDistanceMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxDistanceMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'A delivery fee cannot be negative' })
  @Max(MAX_DELIVERY_FEE_PKR)
  fee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1000)
  @Max(1000)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// --- Settings ------------------------------------------------------------

/**
 * Platform settings, all optional — a save writes only what changed.
 *
 * The bounds mirror the schema exactly. They are restated rather than derived
 * so a bad value is refused with a sentence an admin can act on, instead of a
 * Mongoose validation error, while the schema keeps the last word for any write
 * that does not come through this DTO.
 */
export class UpdatePlatformSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'The delivery radius must be a whole number of metres' })
  @Min(500, { message: 'A delivery radius below 500 m would serve nobody' })
  @Max(100_000)
  maxDeliveryDistanceMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  defaultLowStockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  orderingEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? normalisePkPhone(value) : value))
  @Matches(PK_MOBILE_E164, { message: 'Enter a valid Pakistani mobile number, e.g. 03001234567' })
  supportPhone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'A valid support email address is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  supportEmail?: string;
}

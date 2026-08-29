import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { Role } from 'src/common/enums';

/** ADMIN-only. Role changes are never accepted on self-service endpoints. */
export class UpdateUserRoleDto {
  @IsEnum(Role)
  role: Role;

  /** Required when promoting to STORE_MANAGER. */
  @IsOptional()
  @IsMongoId()
  storeId?: string;
}

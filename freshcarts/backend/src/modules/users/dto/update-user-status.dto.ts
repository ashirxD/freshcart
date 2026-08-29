import { IsBoolean } from 'class-validator';

/** ADMIN-only. Deactivation is a soft block; accounts are never hard-deleted. */
export class UpdateUserStatusDto {
  @IsBoolean()
  isActive: boolean;
}

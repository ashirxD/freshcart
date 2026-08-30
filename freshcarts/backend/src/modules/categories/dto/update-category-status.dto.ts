import { IsBoolean } from 'class-validator';

/** Deactivate (false) or reactivate (true) a category. */
export class UpdateCategoryStatusDto {
  @IsBoolean()
  isActive: boolean;
}

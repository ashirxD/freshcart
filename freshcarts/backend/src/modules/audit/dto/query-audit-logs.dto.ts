import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto';
import { AuditAction, AuditEntity } from '../schemas';

/** Filters for the admin audit view. Every one narrows an indexed field. */
export class QueryAuditLogsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsEnum(AuditEntity)
  entityType?: AuditEntity;

  /** Not @IsMongoId: the settings singleton's entity id is not an ObjectId. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @IsOptional()
  @IsMongoId()
  actorId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

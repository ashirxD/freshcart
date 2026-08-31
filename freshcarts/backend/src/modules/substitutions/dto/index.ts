import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SubstitutionReason } from '../schemas';

/**
 * A store manager's proposal.
 *
 * Note the absence of any price field. The charged price comes from the order
 * line and the replacement's price comes from the catalogue — there is nowhere
 * for a client to influence what the shopper pays (§29).
 */
export class ProposeSubstitutionDto {
  @IsMongoId({ message: 'replacementProductId must be a valid product id' })
  replacementProductId: string;

  /**
   * How many of the replacement to supply. Defaults to the original quantity,
   * which is the common case; a different count is how a picker offers two small
   * packs in place of one large one.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  replacementQuantity?: number;

  @IsEnum(SubstitutionReason, { message: 'reason must be a supported substitution reason' })
  reason: SubstitutionReason;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

/** The customer's answer, or the store withdrawing its own proposal. */
export enum SubstitutionDecision {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
}

export class DecideSubstitutionDto {
  @IsEnum(SubstitutionDecision, { message: 'decision must be ACCEPT or REJECT' })
  decision: SubstitutionDecision;
}

import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

/**
 * Rejects malformed ObjectIds at the edge.
 *
 * Without this a bad `:id` reaches Mongoose and surfaces as a CastError, which
 * is a 400 with a much less useful message — and it costs a database round trip
 * to discover something the string itself already told us.
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Malformed identifier');
    }
    return value;
  }
}

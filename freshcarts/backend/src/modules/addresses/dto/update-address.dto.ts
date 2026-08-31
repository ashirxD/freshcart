import { PartialType } from '@nestjs/mapped-types';
import { CreateAddressDto } from './create-address.dto';

/**
 * Every field optional, same rules when present.
 *
 * Clearing coordinates is deliberately not expressible: an address that had a
 * map location and silently lost it would start failing delivery for reasons
 * the shopper cannot see. Moving the pin means sending a new pair.
 */
export class UpdateAddressDto extends PartialType(CreateAddressDto) {}

import { PartialType } from '@nestjs/mapped-types';
import { CreateStoreDto } from './create-store.dto';

/** Every field optional; the service still re-checks slug uniqueness on change. */
export class UpdateStoreDto extends PartialType(CreateStoreDto) {}

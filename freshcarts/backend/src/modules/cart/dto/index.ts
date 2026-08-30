import { Type } from 'class-transformer';
import { IsInt, IsMongoId, Max, Min } from 'class-validator';
import { MAX_CART_ITEM_QUANTITY } from '../schemas';

/**
 * Note what is absent: price, name, unit, image. The server reads all of those
 * from the catalogue, so there is no field a client could use to influence what
 * it is charged.
 */
export class AddCartItemDto {
  @IsMongoId({ message: 'productId must be a valid product id' })
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(MAX_CART_ITEM_QUANTITY)
  quantity: number = 1;
}

export class UpdateCartItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1. Remove the item to take it out of the cart.' })
  @Max(MAX_CART_ITEM_QUANTITY)
  quantity: number;
}

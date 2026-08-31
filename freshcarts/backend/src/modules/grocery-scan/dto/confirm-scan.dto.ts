import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsMongoId,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_CART_ITEM_QUANTITY } from 'src/modules/cart/schemas';

/**
 * The security boundary for adding a scanned list to the cart (§29, §61, §67).
 *
 * Look at what this type CANNOT express. There is no price, no product name, no
 * unit, no image, no stock figure, no match confidence and no OCR text. The
 * only thing a client may send is a product id and a quantity — the same two
 * fields the ordinary add-to-cart endpoint accepts, because this IS the
 * ordinary add-to-cart operation with a different entry point.
 *
 * That is what makes "never trust the OCR price" and "never trust the frontend
 * price" structural rather than a rule someone has to remember: combined with
 * the global `forbidNonWhitelisted` pipe, a request carrying `price` is
 * rejected with a 400 naming the field, and a request carrying a product id
 * from another store is rejected by the catalogue lookup that follows.
 */
export class ConfirmScanItemDto {
  @IsMongoId({ message: 'productId must be a valid product id' })
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(MAX_CART_ITEM_QUANTITY)
  quantity: number;
}

/** How many scanned lines may be confirmed at once. */
export const MAX_CONFIRM_ITEMS = 60;

export class ConfirmScanDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Choose at least one item to add to your cart' })
  @ArrayMaxSize(MAX_CONFIRM_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => ConfirmScanItemDto)
  items: ConfirmScanItemDto[];
}

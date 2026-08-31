import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, Roles } from 'src/common/decorators';
import { Role } from 'src/common/enums';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto';

/**
 * The cart is addressed as "mine", never by id.
 *
 * Every handler derives the owner from the verified JWT principal, so there is
 * no parameter a client could change to reach someone else's basket — the class
 * of bug that ownership checks exist to catch simply has no surface here.
 */
@Controller('cart')
@Roles(Role.CUSTOMER)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser('userId') userId: string) {
    return this.cartService.getCart(userId);
  }

  @Post('items')
  addItem(@CurrentUser('userId') userId: string, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(userId, dto);
  }

  @Patch('items/:productId')
  updateItem(
    @CurrentUser('userId') userId: string,
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(userId, productId, dto);
  }

  @Delete('items/:productId')
  removeItem(
    @CurrentUser('userId') userId: string,
    @Param('productId', ParseObjectIdPipe) productId: string,
  ) {
    return this.cartService.removeItem(userId, productId);
  }

  /**
   * "I have seen the new prices, continue."
   *
   * Checkout blocks while a line's price differs from the one the shopper
   * agreed to; this is how they acknowledge the change. It copies live
   * catalogue prices onto the cart's agreed-price field and can do nothing
   * else — there is no body, so there is no price a client could supply.
   */
  @Post('accept-prices')
  acceptPrices(@CurrentUser('userId') userId: string) {
    return this.cartService.acceptCurrentPrices(userId);
  }

  @Delete()
  clear(@CurrentUser('userId') userId: string) {
    return this.cartService.clear(userId);
  }
}

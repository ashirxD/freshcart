import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser, Roles } from 'src/common/decorators';
import { Role } from 'src/common/enums';
import { CheckoutService } from './checkout.service';
import { CheckoutPreviewDto } from './dto';

/**
 * One endpoint: "given these choices, what would I pay?".
 *
 * POST rather than GET despite being a read, because the answer depends on a
 * body (fulfilment, address, payment method) and — more importantly — because
 * it must never be cached. A checkout total is per-shopper, per-minute
 * financial data; a proxy or browser holding on to one would show somebody an
 * out-of-date price with full confidence.
 *
 * 200, not 201: nothing is created. Placing the order is POST /orders, and it
 * re-validates everything this returned.
 */
@Controller('checkout')
@Roles(Role.CUSTOMER)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(@CurrentUser('userId') userId: string, @Body() dto: CheckoutPreviewDto) {
    return this.checkoutService.preview(userId, dto);
  }
}

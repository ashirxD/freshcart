import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles } from 'src/common/decorators';
import { Role } from 'src/common/enums';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { CancelOrderDto, CreateOrderDto } from 'src/modules/checkout';
import { QueryOrdersDto } from './dto';
import { OrdersService } from './orders.service';

/** Bounds the header so a client cannot use it as a storage channel. */
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;

/**
 * Customer order endpoints.
 *
 * Every route derives its owner from the verified principal and passes it to a
 * service that puts it in the query filter — there is no id a client can change
 * to reach another shopper's order.
 *
 * Note what is absent: nothing here accepts a status. Order state moves through
 * OrdersService.changeStatus and the state machine only. The single
 * customer-initiated transition is `cancel`, which is a named action with its
 * own rules, not a status write.
 */
@Controller('orders')
@Roles(Role.CUSTOMER)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(@CurrentUser('userId') userId: string, @Query() query: QueryOrdersDto) {
    return this.ordersService.listForCustomer(userId, query);
  }

  @Get(':id')
  findOne(@CurrentUser('userId') userId: string, @Param('id', ParseObjectIdPipe) id: string) {
    return this.ordersService.findForCustomer(userId, id);
  }

  /**
   * Places the order.
   *
   * The `Idempotency-Key` header is required, not optional. A duplicate order
   * is the single most damaging thing this endpoint can do — the shopper is
   * billed twice and the store picks twice — and making the protection
   * opt-in means it is absent for exactly the clients least likely to handle
   * retries carefully. See IdempotencyService for the full strategy.
   *
   * Returns 201 with the full order, so the confirmation screen needs no second
   * request.
   */
  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException(
        'An Idempotency-Key header is required to place an order. Send a unique key (for example a UUID) and reuse it if you retry.',
      );
    }

    return this.ordersService.create(userId, dto, idempotencyKey);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelForCustomer(userId, id, dto.reason);
  }
}

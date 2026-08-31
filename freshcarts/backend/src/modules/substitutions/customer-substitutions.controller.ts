import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { CurrentUser, Roles } from 'src/common/decorators';
import { Role } from 'src/common/enums';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { DecideSubstitutionDto } from './dto';
import { SubstitutionsService } from './substitutions.service';

/**
 * The shopper's side of a substitution.
 *
 * Mounted on the `orders` prefix so the URLs read the way the resource nests,
 * but declared here rather than on OrdersController for a structural reason:
 * substitutions depend on orders, and putting these two handlers on the orders
 * controller would make OrdersModule import SubstitutionsModule and close a
 * cycle. Two routes in the module that owns them is the cheaper answer than a
 * `forwardRef` between two modules that otherwise have a clean direction.
 *
 * Both routes are CUSTOMER-only and scoped by the verified `userId` inside the
 * service, so a shopper can only ever see and answer their own proposals.
 */
@Controller('orders')
@Roles(Role.CUSTOMER)
export class CustomerSubstitutionsController {
  constructor(private readonly substitutionsService: SubstitutionsService) {}

  @Get(':orderId/substitutions')
  list(
    @CurrentUser('userId') userId: string,
    @Param('orderId', ParseObjectIdPipe) orderId: string,
  ) {
    return this.substitutionsService.listForCustomerOrder(userId, orderId);
  }

  /**
   * Accept or reject a proposed replacement.
   *
   * The one customer action that changes an order's *contents* — and it is still
   * not a status write. Accepting swaps the line and leaves the agreed total
   * untouched; rejecting leaves the order exactly as it was. See the price rule
   * in SubstitutionsService for why acceptance can never cost more.
   */
  @Patch('substitutions/:substitutionId')
  decide(
    @CurrentUser('userId') userId: string,
    @Param('substitutionId', ParseObjectIdPipe) substitutionId: string,
    @Body() dto: DecideSubstitutionDto,
  ) {
    return this.substitutionsService.decide(userId, substitutionId, dto);
  }
}

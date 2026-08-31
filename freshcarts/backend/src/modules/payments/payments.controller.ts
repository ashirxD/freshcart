import { Controller, Get } from '@nestjs/common';
import { Roles } from 'src/common/decorators';
import { Role } from 'src/common/enums';
import { PaymentsService } from './payments.service';

/**
 * One read-only endpoint: which payment methods may actually be chosen.
 *
 * The checkout screen renders exactly what this returns, so a method cannot
 * appear in the UI because a developer added it to an enum — §28's rule is
 * enforced by there being no other list for the client to read.
 */
@Controller('payments')
@Roles(Role.CUSTOMER)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('methods')
  methods() {
    return this.paymentsService.availableMethods();
  }
}

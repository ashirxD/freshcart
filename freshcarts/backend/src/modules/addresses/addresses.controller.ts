import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, Roles } from 'src/common/decorators';
import { Role } from 'src/common/enums';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto';

/**
 * Addresses are addressed as "mine".
 *
 * Every handler passes the JWT-derived `userId` into the service, which puts it
 * in the query filter. There is no admin route here on purpose: nothing in this
 * milestone needs staff to browse customer addresses, and the delivery snapshot
 * on an order already carries what operations actually require.
 */
@Controller('addresses')
@Roles(Role.CUSTOMER)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  list(@CurrentUser('userId') userId: string) {
    return this.addressesService.list(userId);
  }

  @Get(':id')
  findOne(@CurrentUser('userId') userId: string, @Param('id', ParseObjectIdPipe) id: string) {
    return this.addressesService.findOneOrFail(userId, id);
  }

  @Post()
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateAddressDto) {
    return this.addressesService.create(userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(userId, id, dto);
  }

  @Patch(':id/default')
  setDefault(@CurrentUser('userId') userId: string, @Param('id', ParseObjectIdPipe) id: string) {
    return this.addressesService.setDefault(userId, id);
  }

  @Delete(':id')
  remove(@CurrentUser('userId') userId: string, @Param('id', ParseObjectIdPipe) id: string) {
    return this.addressesService.remove(userId, id);
  }
}

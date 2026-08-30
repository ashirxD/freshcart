import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from 'src/common/decorators';
import { Role } from 'src/common/enums';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { QueryInventoryDto, UpdateInventoryDto } from './dto';
import { InventoryService } from './inventory.service';

/**
 * Back-office only, at every route. Customers never read a raw quantity — they
 * see the derived availability that ships with each product — and they can
 * certainly never write one.
 *
 * STORE_MANAGER is deliberately not granted access yet: the role exists and is
 * store-scoped, but the manager dashboard is a later milestone. Adding the role
 * here is a one-line change when that lands.
 */
@Controller('inventory')
@Roles(Role.ADMIN)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  list(@Query() query: QueryInventoryDto) {
    return this.inventoryService.list(query);
  }

  @Get(':productId')
  findOne(@Param('productId', ParseObjectIdPipe) productId: string) {
    return this.inventoryService.findForProduct(productId);
  }

  @Patch(':productId')
  update(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    return this.inventoryService.update(productId, dto);
  }
}

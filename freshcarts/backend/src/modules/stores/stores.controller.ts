import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Public, Roles } from 'src/common/decorators';
import { Role } from 'src/common/enums';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { CreateStoreDto, UpdateStoreDto } from './dto';
import { StoresService } from './stores.service';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  /**
   * The store a shopper is currently buying from. Public because the header
   * shows the delivery location before anyone signs in.
   */
  @Public()
  @Get('current')
  current() {
    return this.storesService.findActiveStore();
  }

  @Get()
  @Roles(Role.ADMIN)
  list(@Query('includeInactive') includeInactive?: string) {
    return this.storesService.list(includeInactive === 'true');
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.storesService.findByIdOrFail(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateStoreDto) {
    return this.storesService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateStoreDto) {
    return this.storesService.update(id, dto);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Public, Roles } from 'src/common/decorators';
import { Role } from 'src/common/enums';
import { AuthenticatedUser } from 'src/common/interfaces';
import { ParseObjectIdPipe } from 'src/common/pipes';
import {
  CreateProductDto,
  QueryProductsDto,
  UpdateProductDto,
  UpdateProductStatusDto,
} from './dto';
import { ProductsService } from './products.service';

/**
 * Browsing is public; anything that changes the catalogue is ADMIN-only.
 *
 * Customers and admins share the read routes. `includeInactive` is honoured for
 * admins alone, so the back office can list deactivated products without a
 * duplicate set of endpoints — and a shopper passing the flag simply gets the
 * normal catalogue.
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  list(@Query() query: QueryProductsDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.productsService.list(query, {
      includeInactive: query.includeInactive === true && user?.role === Role.ADMIN,
    });
  }

  /** Distinct brands for the filter panel. Literal path, declared before `:idOrSlug`. */
  @Public()
  @Get('brands')
  listBrands() {
    return this.productsService.listBrands();
  }

  @Public()
  @Get(':idOrSlug')
  findOne(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.productsService.findOneOrFail(idOrSlug, {
      includeInactive: user?.role === Role.ADMIN,
    });
  }

  @Public()
  @Get(':idOrSlug/related')
  findRelated(@Param('idOrSlug') idOrSlug: string) {
    return this.productsService.findRelated(idOrSlug);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  setStatus(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateProductStatusDto) {
    return this.productsService.setActive(id, dto.isActive);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.productsService.remove(id);
  }
}

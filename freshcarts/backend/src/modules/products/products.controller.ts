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
import { AuditAction, AuditEntity, AuditService } from 'src/modules/audit';
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
  constructor(
    private readonly productsService: ProductsService,
    /**
     * Audit recording lives in the controller rather than the service because
     * the actor is a property of the request, not of the domain operation. A
     * seeder or a future import job calls the same service methods and should
     * not have to invent an actor to satisfy a log.
     */
    private readonly auditService: AuditService,
  ) {}

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
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductDto) {
    const product = await this.productsService.create(dto);

    await this.auditService.record({
      actor: { userId: user.userId, role: user.role },
      action: AuditAction.PRODUCT_CREATED,
      entityType: AuditEntity.PRODUCT,
      entityId: product.id,
      metadata: { sku: product.sku, name: product.name, sellingPrice: product.sellingPrice },
    });

    return product;
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const product = await this.productsService.update(id, dto);

    await this.auditService.record({
      actor: { userId: user.userId, role: user.role },
      action: AuditAction.PRODUCT_UPDATED,
      entityType: AuditEntity.PRODUCT,
      entityId: id,
      // The fields touched and the resulting price. Not the whole DTO: section
      // 27 asks for who/what/which/when, not a copy of the request body.
      metadata: {
        sku: product.sku,
        fields: Object.keys(dto).join(','),
        sellingPrice: product.sellingPrice,
      },
    });

    return product;
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  async setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    const product = await this.productsService.setActive(id, dto.isActive);

    await this.auditService.record({
      actor: { userId: user.userId, role: user.role },
      action: AuditAction.PRODUCT_STATUS_CHANGED,
      entityType: AuditEntity.PRODUCT,
      entityId: id,
      metadata: { sku: product.sku, name: product.name, isActive: dto.isActive },
    });

    return product;
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.productsService.remove(id);
  }
}

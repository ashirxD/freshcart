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
import { CurrentUser, Roles } from 'src/common/decorators';
import { Role } from 'src/common/enums';
import { AuthenticatedUser } from 'src/common/interfaces';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { AuditAction, AuditEntity, AuditService, QueryAuditLogsDto } from 'src/modules/audit';
import { DeliveryPricingService } from 'src/modules/delivery';
import { InventoryService } from 'src/modules/inventory';
import { QueryInventoryDto, UpdateInventoryDto } from 'src/modules/inventory/dto';
import { OrdersService, QueryAdminOrdersDto } from 'src/modules/orders';
import { SettingsService } from 'src/modules/settings';
import { StoresService } from 'src/modules/stores';
import { AdminService } from './admin.service';
import {
  CreateDeliveryRuleDto,
  CreateStoreManagerDto,
  OverrideOrderStatusDto,
  QueryCustomersDto,
  QueryStoreManagersDto,
  SetAccountStatusDto,
  UpdateDeliveryRuleDto,
  UpdatePlatformSettingsDto,
  UpdateStoreManagerDto,
} from './dto';

/**
 * THE ADMIN CONTROL CENTRE
 * ========================
 *
 * `@Roles(Role.ADMIN)` on the class closes every route below it, and the global
 * RolesGuard enforces it — a customer or a store manager reaching any of these
 * gets a 403 regardless of what any frontend does or does not render.
 *
 * WHAT IS HERE, and what deliberately is not.
 *
 * Here: the operations that only exist for an admin — the platform dashboard,
 * customer and staff management, cross-store order visibility, delivery pricing
 * configuration, business settings, and the audit trail.
 *
 * Not here: products, categories and stores. Those already have ADMIN-guarded
 * write routes on `/products`, `/categories` and `/stores`, and section 104
 * warns against maintaining two endpoints for the same operation. The admin
 * frontend calls those directly. Inventory *is* mirrored below, because the
 * admin surface needs it store-scoped in a way `/inventory` is not.
 *
 * Every handler is thin. The dashboard aggregation lives in AdminService, the
 * order state machine in OrdersService, pricing in DeliveryPricingService,
 * business config in SettingsService — this file maps HTTP to those and shapes
 * nothing of its own.
 */
@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly ordersService: OrdersService,
    private readonly inventoryService: InventoryService,
    private readonly pricingService: DeliveryPricingService,
    private readonly settingsService: SettingsService,
    private readonly storesService: StoresService,
    private readonly auditService: AuditService,
  ) {}

  // --- Dashboard ----------------------------------------------------------

  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  // --- Customers ----------------------------------------------------------

  @Get('customers')
  listCustomers(@Query() query: QueryCustomersDto) {
    return this.adminService.listCustomers(query);
  }

  @Get('customers/:id')
  findCustomer(@Param('id', ParseObjectIdPipe) id: string) {
    return this.adminService.findCustomer(id);
  }

  @Patch('customers/:id/status')
  setCustomerStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SetAccountStatusDto,
  ) {
    return this.adminService.setCustomerStatus(actorOf(user), id, dto.isActive);
  }

  // --- Store managers -----------------------------------------------------

  @Get('store-managers')
  listStoreManagers(@Query() query: QueryStoreManagersDto) {
    return this.adminService.listStoreManagers(query);
  }

  @Get('store-managers/:id')
  findStoreManager(@Param('id', ParseObjectIdPipe) id: string) {
    return this.adminService.findStoreManager(id);
  }

  @Post('store-managers')
  createStoreManager(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStoreManagerDto) {
    return this.adminService.createStoreManager(actorOf(user), dto);
  }

  @Patch('store-managers/:id')
  updateStoreManager(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateStoreManagerDto,
  ) {
    return this.adminService.updateStoreManager(actorOf(user), id, dto);
  }

  /**
   * Deactivation, not deletion. A manager who has confirmed orders is named in
   * their status history; removing the account would orphan that record.
   */
  @Patch('store-managers/:id/status')
  setStoreManagerStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SetAccountStatusDto,
  ) {
    return this.adminService.updateStoreManager(actorOf(user), id, { isActive: dto.isActive });
  }

  // --- Orders -------------------------------------------------------------

  @Get('orders')
  listOrders(@Query() query: QueryAdminOrdersDto) {
    return this.ordersService.listForAdmin(query);
  }

  @Get('orders/:id')
  findOrder(@Param('id', ParseObjectIdPipe) id: string) {
    return this.ordersService.findForAdmin(id);
  }

  /**
   * An operational override.
   *
   * The transition still goes through the same state machine a store manager's
   * click does — an admin cannot send a pickup order out for delivery, cannot
   * revive a cancelled order, and cannot skip a step. What they gain is reach
   * across stores, plus the ability to act when nobody at the store can. The
   * reason is mandatory and lands in the customer's own timeline as well as the
   * audit trail (section 21).
   */
  @Patch('orders/:id/status')
  async overrideOrderStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: OverrideOrderStatusDto,
  ) {
    const order = await this.ordersService.overrideStatusForAdmin(
      id,
      dto.status,
      { userId: user.userId, role: user.role },
      dto.reason,
    );

    await this.auditService.record({
      actor: actorOf(user),
      action: AuditAction.ORDER_STATUS_OVERRIDDEN,
      entityType: AuditEntity.ORDER,
      entityId: id,
      storeId: order.store.id,
      metadata: { orderNumber: order.orderNumber, status: dto.status, reason: dto.reason },
    });

    return order;
  }

  // --- Inventory ----------------------------------------------------------
  //
  // Mirrored from `/inventory` rather than proxied, because the admin screen
  // reads and writes exactly what InventoryService already exposes and the
  // alternative — a second service method — would duplicate the guarded-update
  // strategy that must exist in one place.

  @Get('inventory')
  listInventory(@Query() query: QueryInventoryDto) {
    return this.inventoryService.list(query);
  }

  @Patch('inventory/:productId')
  async updateInventory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    const result = await this.inventoryService.update(productId, dto, { actor: user });

    await this.auditService.record({
      actor: actorOf(user),
      action: AuditAction.INVENTORY_ADJUSTED,
      entityType: AuditEntity.INVENTORY,
      entityId: productId,
      metadata: {
        quantity: result.quantity,
        lowStockThreshold: result.lowStockThreshold,
        changeReason: dto.changeReason,
      },
    });

    return result;
  }

  // --- Delivery pricing ---------------------------------------------------
  //
  // Configuration only. The engine in DeliveryPricingService.priceFor stays
  // authoritative and is untouched by anything below (section 17).

  @Get('delivery/pricing-rules')
  async listPricingRules() {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const maxDistance = await this.settingsService.maxDeliveryDistanceMeters();

    return this.pricingService.listRules(storeId, maxDistance);
  }

  @Post('delivery/pricing-rules')
  async createPricingRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDeliveryRuleDto,
  ) {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const rule = await this.pricingService.createRule(storeId, dto);

    await this.auditService.record({
      actor: actorOf(user),
      action: AuditAction.DELIVERY_RULE_CREATED,
      entityType: AuditEntity.DELIVERY_RULE,
      entityId: rule.id,
      storeId,
      metadata: {
        label: rule.label,
        minDistanceMeters: rule.minDistanceMeters,
        maxDistanceMeters: rule.maxDistanceMeters,
        fee: rule.fee,
      },
    });

    return rule;
  }

  @Patch('delivery/pricing-rules/:id')
  async updatePricingRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateDeliveryRuleDto,
  ) {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const rule = await this.pricingService.updateRule(storeId, id, dto);

    await this.auditService.record({
      actor: actorOf(user),
      action: AuditAction.DELIVERY_RULE_UPDATED,
      entityType: AuditEntity.DELIVERY_RULE,
      entityId: id,
      storeId,
      metadata: {
        label: rule.label,
        minDistanceMeters: rule.minDistanceMeters,
        maxDistanceMeters: rule.maxDistanceMeters,
        fee: rule.fee,
        isActive: rule.isActive,
      },
    });

    return rule;
  }

  @Delete('delivery/pricing-rules/:id')
  @HttpCode(HttpStatus.OK)
  async deletePricingRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const result = await this.pricingService.deleteRule(storeId, id);

    await this.auditService.record({
      actor: actorOf(user),
      action: AuditAction.DELIVERY_RULE_DELETED,
      entityType: AuditEntity.DELIVERY_RULE,
      entityId: id,
      storeId,
    });

    return result;
  }

  // --- Settings -----------------------------------------------------------

  @Get('settings')
  settings() {
    return this.settingsService.view();
  }

  /**
   * Saves business settings.
   *
   * The audit row records each field that genuinely changed, with its before
   * and after — flattened to scalars, because "the settings were saved" is not
   * an auditable fact but "the delivery radius went from 12000 to 8000" is.
   */
  @Patch('settings')
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePlatformSettingsDto,
  ) {
    const { changed } = await this.settingsService.update(dto);

    if (Object.keys(changed).length > 0) {
      const metadata: Record<string, unknown> = {};
      for (const [field, delta] of Object.entries(changed)) {
        metadata[field + '.from'] = (delta as { from: unknown; to: unknown }).from;
        metadata[field + '.to'] = (delta as { from: unknown; to: unknown }).to;
      }

      await this.auditService.record({
        actor: actorOf(user),
        action: AuditAction.SETTINGS_UPDATED,
        entityType: AuditEntity.SETTINGS,
        entityId: 'platform',
        metadata,
      });
    }

    return this.settingsService.view();
  }

  // --- Audit --------------------------------------------------------------

  @Get('audit-logs')
  listAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.auditService.list(query);
  }
}

/**
 * The audit actor for a request.
 *
 * Always built from the verified principal, never from a body or a header, so
 * there is no route on this controller through which an action could be
 * attributed to somebody else.
 */
function actorOf(user: AuthenticatedUser): { userId: string; role: Role } {
  return { userId: user.userId, role: user.role };
}

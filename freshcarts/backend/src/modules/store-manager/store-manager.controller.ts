import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from 'src/common/decorators';
import { Role } from 'src/common/enums';
import { AuthenticatedUser } from 'src/common/interfaces';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { AuditAction, AuditEntity, AuditService } from 'src/modules/audit';
import { QueryInventoryDto, UpdateInventoryDto } from 'src/modules/inventory/dto';
import { InventoryService } from 'src/modules/inventory';
import { OrderStatus, OrdersService, QueryStoreOrdersDto } from 'src/modules/orders';
import { QueryProductsDto } from 'src/modules/products/dto';
import { ProductsService } from 'src/modules/products';
import { ProposeSubstitutionDto, SubstitutionsService } from 'src/modules/substitutions';
import {
  OrderRejectionReason,
  REJECTION_REASON_TEXT,
  RejectStoreOrderDto,
  UpdateProductAvailabilityDto,
  UpdateStoreOrderStatusDto,
} from './dto';
import { StoreManagerService } from './store-manager.service';
import { resolveManagerStoreId } from './store-scope';

/**
 * THE STORE OPERATIONS API
 * ========================
 *
 * `@Roles(Role.STORE_MANAGER)` on the class closes every route below it, and
 * the global RolesGuard enforces it — a customer reaching any of these gets a
 * 403 regardless of what the frontend does or does not render (§55).
 *
 * Every handler then calls `resolveManagerStoreId` and passes the result down.
 * That is the whole store-ownership strategy: the scope comes from the verified
 * principal, and each domain service receives it as an explicit argument which
 * lands *in the query filter*. No handler here accepts a `storeId`, so there is
 * no parameter a manager could tamper with to reach another shop (§3, §56).
 *
 * ADMIN is deliberately NOT granted access. An admin has no store binding, so
 * "their store" would have to mean the configured default — a silent
 * single-store assumption that would quietly become wrong the day a second store
 * exists. Admins already have their own surface; this one belongs to staff.
 *
 * Note also what this controller does not contain: no transition table, no stock
 * arithmetic, no product validation. It maps HTTP to a domain call and shapes
 * the response (§49, §51, §52, §53).
 */
@Controller('store-manager')
@Roles(Role.STORE_MANAGER)
export class StoreManagerController {
  constructor(
    private readonly storeManagerService: StoreManagerService,
    private readonly ordersService: OrdersService,
    private readonly inventoryService: InventoryService,
    private readonly productsService: ProductsService,
    private readonly substitutionsService: SubstitutionsService,
    /**
     * Section 26 names store operations explicitly: a manager changing stock or
     * moving an order is an administrative action and belongs in the trail
     * beside an admin's. The actor is the verified principal, never the body.
     */
    private readonly auditService: AuditService,
  ) {}

  // --- Dashboard ----------------------------------------------------------

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.storeManagerService.dashboard(resolveManagerStoreId(user));
  }

  // --- Orders -------------------------------------------------------------

  @Get('orders')
  listOrders(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryStoreOrdersDto) {
    return this.ordersService.listForStore(resolveManagerStoreId(user), query);
  }

  /** The order plus its substitution proposals — what the picking screen needs. */
  @Get('orders/:id')
  findOrder(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.storeManagerService.orderWithSubstitutions(resolveManagerStoreId(user), id);
  }

  /**
   * Advances an order.
   *
   * One endpoint for every forward step — confirm, prepare, pack, dispatch,
   * complete — because they are all the same operation: "move this order to that
   * status, if the machine allows it". Separate endpoints per verb would be five
   * places for the store-scope check to be forgotten.
   *
   * Whether a reason is required depends on the target status, so that rule lives
   * in `advanceForStore` — server-side, and shared with the reject endpoint.
   */
  @Patch('orders/:id/status')
  async updateOrderStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateStoreOrderStatusDto,
  ) {
    const storeId = resolveManagerStoreId(user);

    const order = await this.ordersService.advanceForStore(
      storeId,
      id,
      dto.status,
      { userId: user.userId, role: user.role },
      { reason: dto.reason },
    );

    await this.auditService.record({
      actor: { userId: user.userId, role: user.role },
      action: AuditAction.ORDER_STATUS_CHANGED,
      entityType: AuditEntity.ORDER,
      entityId: id,
      storeId,
      metadata: { orderNumber: order.orderNumber, status: dto.status },
    });

    return order;
  }

  /**
   * Rejects a pending order.
   *
   * Its own endpoint rather than a status update, because a rejection is a
   * decision with a required, structured reason — and the shopper-facing sentence
   * is composed here from a preset, so a manager's internal shorthand never
   * becomes the customer's explanation.
   */
  @Post('orders/:id/reject')
  async rejectOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RejectStoreOrderDto,
  ) {
    const storeId = resolveManagerStoreId(user);
    const note = dto.note?.trim();

    const customerFacing = REJECTION_REASON_TEXT[dto.reason] + (note ? ' ' + note : '');

    const order = await this.ordersService.advanceForStore(
      storeId,
      id,
      OrderStatus.REJECTED,
      { userId: user.userId, role: user.role },
      {
        // What the shopper reads in their timeline.
        note: customerFacing,
        // What is recorded as the cancellation reason on the order.
        reason: this.rejectionReasonCode(dto.reason, note),
      },
    );

    await this.auditService.record({
      actor: { userId: user.userId, role: user.role },
      action: AuditAction.ORDER_STATUS_CHANGED,
      entityType: AuditEntity.ORDER,
      entityId: id,
      storeId,
      // The reason CODE, not the manager's free-text note: the code is what
      // makes "how many orders did we reject for being out of stock?"
      // answerable, and the note may name a customer.
      metadata: {
        orderNumber: order.orderNumber,
        status: OrderStatus.REJECTED,
        reason: dto.reason,
      },
    });

    return order;
  }

  private rejectionReasonCode(reason: OrderRejectionReason, note?: string): string {
    return note ? reason + ': ' + note : reason;
  }

  // --- Substitutions ------------------------------------------------------

  @Get('orders/:orderId/substitutions')
  listSubstitutions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseObjectIdPipe) orderId: string,
  ) {
    return this.substitutionsService.listForStoreOrder(resolveManagerStoreId(user), orderId);
  }

  /**
   * Proposes a replacement for one line.
   *
   * The line is addressed by its product id: order items are embedded
   * subdocuments without their own ids, and a product appears at most once per
   * order, so `(orderId, productId)` names the line unambiguously.
   */
  @Post('orders/:orderId/items/:productId/substitution')
  proposeSubstitution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseObjectIdPipe) orderId: string,
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Body() dto: ProposeSubstitutionDto,
  ) {
    return this.substitutionsService.propose(
      {
        storeId: resolveManagerStoreId(user),
        actorId: user.userId,
        actorRole: user.role,
      },
      orderId,
      productId,
      dto,
    );
  }

  /** Withdraws an open proposal. The store's own change of mind, not the customer's. */
  @Delete('substitutions/:id')
  cancelSubstitution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.substitutionsService.cancel(
      { storeId: resolveManagerStoreId(user), actorRole: user.role },
      id,
    );
  }

  // --- Inventory ----------------------------------------------------------

  @Get('inventory')
  listInventory(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryInventoryDto) {
    return this.inventoryService.list(query, resolveManagerStoreId(user));
  }

  @Get('inventory/:productId')
  findInventory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseObjectIdPipe) productId: string,
  ) {
    return this.inventoryService.findForProduct(productId, resolveManagerStoreId(user));
  }

  /** Recent stock movements for one product — who changed it, when, and why. */
  @Get('inventory/:productId/history')
  inventoryHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseObjectIdPipe) productId: string,
  ) {
    return this.inventoryService.recentAdjustments(productId, resolveManagerStoreId(user));
  }

  /**
   * Sets or adjusts stock.
   *
   * Straight to InventoryService (§52): the guarded-update strategy, the
   * absolute/relative distinction and the low-stock derivation all live there,
   * and the actor is passed through so the audit row is attributed to the
   * verified principal rather than to anything in the body.
   */
  @Patch('inventory/:productId')
  async updateInventory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    const storeId = resolveManagerStoreId(user);

    const result = await this.inventoryService.update(productId, dto, { storeId, actor: user });

    await this.auditService.record({
      actor: { userId: user.userId, role: user.role },
      action: AuditAction.INVENTORY_ADJUSTED,
      entityType: AuditEntity.INVENTORY,
      entityId: productId,
      storeId,
      metadata: {
        quantity: result.quantity,
        lowStockThreshold: result.lowStockThreshold,
        changeReason: dto.changeReason,
      },
    });

    return result;
  }

  // --- Products -----------------------------------------------------------

  /**
   * The store's products, including deactivated ones.
   *
   * Read-only plus availability, which is the whole of a manager's product
   * permission set. Pricing, categories, SKUs and product creation stay with
   * ADMIN — §37 asks for that split explicitly, and it is enforced by there
   * being no route here that could change them.
   */
  @Get('products')
  listProducts(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryProductsDto) {
    return this.productsService.list(query, {
      includeInactive: true,
      storeId: resolveManagerStoreId(user),
    });
  }

  @Get('products/:id')
  findProduct(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.productsService.findOneOrFail(id, {
      includeInactive: true,
      storeId: resolveManagerStoreId(user),
    });
  }

  /**
   * Takes a product off sale, or puts it back.
   *
   * Availability, not deletion (§36). A product that cannot be sold today is
   * still a product; removing it would destroy catalogue data and orphan the
   * order history that references it.
   */
  @Patch('products/:id/availability')
  async updateProductAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProductAvailabilityDto,
  ) {
    const storeId = resolveManagerStoreId(user);
    const isActive = dto.availability === 'AVAILABLE';

    const product = await this.productsService.setActive(id, isActive, storeId);

    await this.auditService.record({
      actor: { userId: user.userId, role: user.role },
      action: AuditAction.PRODUCT_STATUS_CHANGED,
      entityType: AuditEntity.PRODUCT,
      entityId: id,
      storeId,
      metadata: { sku: product.sku, name: product.name, isActive },
    });

    return product;
  }
}

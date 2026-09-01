import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, StockStatus } from 'src/common/enums';
import { PaginatedResult } from 'src/common/dto';
import { AuditAction, AuditActor, AuditEntity, AuditService } from 'src/modules/audit';
import { CategoriesService } from 'src/modules/categories';
import { InventoryService } from 'src/modules/inventory';
import { AdminOrderMetrics, OrdersService } from 'src/modules/orders';
import { ProductsService } from 'src/modules/products';
import { SettingsService } from 'src/modules/settings';
import { StoreDocument, StoresService } from 'src/modules/stores';
import { PublicUser, UsersService } from 'src/modules/users/users.service';
import {
  CreateStoreManagerDto,
  QueryCustomersDto,
  QueryStoreManagersDto,
  UpdateStoreManagerDto,
} from './dto';

/**
 * THE CONTROL-CENTRE SUMMARY
 *
 * The numbers a person running FreshCarts actually acts on, and nothing else.
 * Section 4 is explicit that a metric must be backed by reliable data, so every
 * figure here is a count or a sum over a field the system already stores —
 * there is no derived rate, no trend line, no forecast, and no tile that would
 * need a caveat to be honest.
 */
export interface AdminDashboard {
  orders: AdminOrderMetrics;
  catalogue: {
    activeProducts: number;
    inactiveProducts: number;
    categories: number;
  };
  inventory: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
  };
  people: {
    customers: number;
    activeCustomers: number;
    storeManagers: number;
  };
  stores: {
    total: number;
    active: number;
    /** Stores inside their opening hours right now. */
    open: number;
  };
  platform: {
    orderingEnabled: boolean;
    maxDeliveryDistanceMeters: number;
  };
}

/** A customer row, as the admin list renders it. */
export interface AdminCustomerSummary {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

/** A customer, plus the trading history the account document does not hold. */
export interface AdminCustomerDetail extends AdminCustomerSummary {
  orderCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
}

/** A staff account with the store it runs resolved to a name. */
export interface AdminStoreManagerView {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  store: { id: string; name: string } | null;
}

/**
 * ADMIN SERVICE — orchestration only
 * ==================================
 *
 * The same rule StoreManagerService follows, for the same reason. There is no
 * state machine here, no stock arithmetic, no pricing, and no query built
 * against a collection another module owns. Every method is one of two things:
 *
 *   1. an aggregation across domains that no single domain owns (the dashboard),
 *   2. a composition of domain reads that one screen needs together.
 *
 * Orders, products, categories, inventory, stores and delivery pricing are all
 * reached through the service that already owns them, and the controller calls
 * most of those directly rather than routing through a pass-through here — a
 * method that only forwards is just a place for logic to accumulate later.
 *
 * The exception is user management, which lives here because "create a store
 * manager" is genuinely two domains at once — an account, bound to a store —
 * and belongs to neither on its own.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly ordersService: OrdersService,
    private readonly productsService: ProductsService,
    private readonly categoriesService: CategoriesService,
    private readonly inventoryService: InventoryService,
    private readonly storesService: StoresService,
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
  ) {}

  // --- Dashboard ----------------------------------------------------------

  /**
   * The whole control centre in one round trip's worth of work.
   *
   * Seven concurrent reads, each an aggregation or a count against an indexed
   * field — not one request per tile. Section 5 asks for exactly this, and the
   * reason is that a dashboard gets refreshed constantly: a tile-per-request
   * design multiplies that traffic tenfold for numbers drawn from the same few
   * collections.
   *
   * The catalogue and stock figures are scoped to the active store, because
   * that is the only store with a catalogue today and a platform-wide product
   * count would silently change meaning the day a second one is stocked.
   */
  async dashboard(): Promise<AdminDashboard> {
    const storeId = await this.storesService.getActiveStoreObjectId();

    const [orders, products, categories, stock, people, stores, settings] = await Promise.all([
      this.ordersService.platformMetrics(),
      this.productsService.countForStore(storeId),
      this.categoriesService.countActive(storeId),
      this.inventoryService.countByStatus(storeId),
      this.usersService.countByRole(),
      this.storesService.list(true),
      this.settingsService.get(),
    ]);

    return {
      orders,
      catalogue: { ...products, categories },
      inventory: {
        inStock: stock[StockStatus.IN_STOCK],
        lowStock: stock[StockStatus.LOW_STOCK],
        outOfStock: stock[StockStatus.OUT_OF_STOCK],
      },
      people: {
        customers: people.customers,
        activeCustomers: people.activeCustomers,
        storeManagers: people.storeManagers,
      },
      stores: {
        total: stores.length,
        active: stores.filter((store: StoreDocument) => store.isActive).length,
        open: stores.filter((store: StoreDocument) => this.storesService.isAcceptingOrders(store))
          .length,
      },
      platform: {
        orderingEnabled: settings.orderingEnabled,
        maxDeliveryDistanceMeters: settings.maxDeliveryDistanceMeters,
      },
    };
  }

  // --- Customers ----------------------------------------------------------

  /**
   * The customer list.
   *
   * The role is pinned server-side, so there is no query parameter that would
   * let this endpoint return staff or admin accounts. The projection is
   * narrower than `PublicUser` and has never carried a password hash or a
   * refresh token — both are `select: false` on the schema and are not read
   * on this path at all (section 7).
   */
  async listCustomers(query: QueryCustomersDto): Promise<PaginatedResult<AdminCustomerSummary>> {
    const page = await this.usersService.list(query, Role.CUSTOMER);
    return { ...page, items: page.items.map(AdminService.toCustomerSummary) };
  }

  /**
   * One customer, with their trading history.
   *
   * The order figures come from an aggregation over the orders the shopper
   * actually placed, not from a counter on the account that would drift.
   * Cancelled and rejected orders are excluded from spend: money that was never
   * taken is not money spent, and section 8 asks for a total only where it is
   * reliably calculated.
   */
  async findCustomer(userId: string): Promise<AdminCustomerDetail> {
    const user = await this.usersService.findByIdOrFail(userId);

    // Reached by typing a staff id into a customer URL. A 404 rather than a 403
    // keeps the two lists from being usable to enumerate each other.
    if (user.role !== Role.CUSTOMER) throw new NotFoundException('Customer not found');

    const summary = await this.ordersService.customerOrderSummary(user._id);

    return { ...AdminService.toCustomerSummary(UsersService.toPublicUser(user)), ...summary };
  }

  /**
   * Activates or deactivates a customer account.
   *
   * `setActive(false)` clears the stored refresh-token hash, and the JWT
   * strategy re-reads `isActive` from the database on every request, so a
   * deactivated shopper loses access on their next call rather than whenever
   * their access token happens to expire.
   */
  async setCustomerStatus(
    actor: AuditActor,
    userId: string,
    isActive: boolean,
  ): Promise<AdminCustomerSummary> {
    const user = await this.usersService.findByIdOrFail(userId);

    if (user.role !== Role.CUSTOMER) throw new NotFoundException('Customer not found');

    const updated = await this.usersService.setActive(userId, isActive);

    await this.auditService.record({
      actor,
      action: AuditAction.USER_STATUS_CHANGED,
      entityType: AuditEntity.USER,
      entityId: userId,
      metadata: { role: Role.CUSTOMER, isActive },
    });

    return AdminService.toCustomerSummary(UsersService.toPublicUser(updated));
  }

  // --- Store managers -----------------------------------------------------

  async listStoreManagers(
    query: QueryStoreManagersDto,
  ): Promise<PaginatedResult<AdminStoreManagerView>> {
    const page = await this.usersService.list(query, Role.STORE_MANAGER);
    const stores = await this.storeNames();

    const items = page.items
      .map((user) => this.toManagerView(user, stores))
      // Store filtering is applied here rather than in the query because the
      // binding lives on the user document as a nullable field and the list is
      // already a bounded page — a compound index for a filter this rare would
      // cost more on every write than it saves on this screen.
      .filter((manager) => !query.storeId || manager.store?.id === query.storeId);

    return { ...page, items };
  }

  async findStoreManager(userId: string): Promise<AdminStoreManagerView> {
    const user = await this.usersService.findByIdOrFail(userId);

    if (user.role !== Role.STORE_MANAGER) throw new NotFoundException('Store manager not found');

    return this.toManagerView(UsersService.toPublicUser(user), await this.storeNames());
  }

  /**
   * Creates a store manager.
   *
   * The account goes through `UsersService.create` — the same code path
   * customer registration uses — so the password is hashed by PasswordService
   * at the configured cost, the phone is normalised to one canonical form, and
   * the unique index is the final authority on duplicates. Section 10 asks for
   * the existing auth mechanism to be reused; this is it, with a role and a
   * store passed explicitly by ADMIN-guarded code.
   *
   * The store is verified first. Binding a manager to an id that names nothing
   * would produce an account that authenticates and can then do nothing, which
   * is worse than a clear refusal.
   */
  async createStoreManager(
    actor: AuditActor,
    dto: CreateStoreManagerDto,
  ): Promise<AdminStoreManagerView> {
    const store = await this.storesService.findByIdOrFail(dto.storeId);

    const user = await this.usersService.create({
      fullName: dto.fullName,
      phone: dto.phone,
      email: dto.email,
      password: dto.password,
      role: Role.STORE_MANAGER,
      storeId: store._id.toString(),
    });

    await this.auditService.record({
      actor,
      action: AuditAction.STORE_MANAGER_CREATED,
      entityType: AuditEntity.USER,
      entityId: user._id.toString(),
      storeId: store._id,
      // The assignment, and nothing else. Never the password, never the hash.
      metadata: { storeName: store.name },
    });

    return this.toManagerView(UsersService.toPublicUser(user), await this.storeNames());
  }

  /**
   * Edits a store manager: name, email, store assignment, active status.
   *
   * A password field is deliberately absent (see UpdateStoreManagerDto), and so
   * is a role field — changing a role is `PATCH /users/:id/role`, a separate
   * named operation, so it cannot happen as a side effect of an edit form.
   */
  async updateStoreManager(
    actor: AuditActor,
    userId: string,
    dto: UpdateStoreManagerDto,
  ): Promise<AdminStoreManagerView> {
    const user = await this.usersService.findByIdOrFail(userId);

    if (user.role !== Role.STORE_MANAGER) throw new NotFoundException('Store manager not found');

    const changed: Record<string, unknown> = {};

    if (dto.storeId && dto.storeId !== user.storeId?.toString()) {
      const store = await this.storesService.findByIdOrFail(dto.storeId);
      await this.usersService.assignStore(userId, store._id);
      changed.storeName = store.name;
    }

    if (dto.fullName !== undefined || dto.email !== undefined) {
      await this.usersService.updateProfile(userId, {
        fullName: dto.fullName,
        email: dto.email,
      });
      // The audit row records *that* a name or email changed, not what to. The
      // old and new values are personal data and answering "who changed this,
      // and when" does not require storing them (section 27).
      if (dto.fullName !== undefined) changed.fullName = true;
      if (dto.email !== undefined) changed.email = true;
    }

    if (dto.isActive !== undefined && dto.isActive !== user.isActive) {
      await this.usersService.setActive(userId, dto.isActive);
      changed.isActive = dto.isActive;
    }

    if (Object.keys(changed).length === 0) throw new BadRequestException('Nothing to update');

    await this.auditService.record({
      actor,
      action: AuditAction.STORE_MANAGER_UPDATED,
      entityType: AuditEntity.USER,
      entityId: userId,
      metadata: changed,
    });

    return this.findStoreManager(userId);
  }

  // --- Helpers ------------------------------------------------------------

  /** Store id to name. A handful of documents, loaded once per request. */
  private async storeNames(): Promise<Map<string, string>> {
    const stores = await this.storesService.list(true);
    return new Map(stores.map((store) => [store._id.toString(), store.name]));
  }

  private toManagerView(user: PublicUser, stores: Map<string, string>): AdminStoreManagerView {
    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      store: user.storeId
        ? { id: user.storeId, name: stores.get(user.storeId) ?? 'Unknown store' }
        : null,
    };
  }

  /**
   * The customer projection.
   *
   * Narrower than `PublicUser` on purpose: an admin has no operational need for
   * a shopper's language preference or phone-verification timestamp, and the
   * safest way not to leak a field is for the mapper never to read it.
   */
  private static toCustomerSummary(user: PublicUser): AdminCustomerSummary {
    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}

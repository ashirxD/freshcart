import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role, StockStatus } from 'src/common/enums';
import { AuditAction, AuditService } from 'src/modules/audit';
import { CategoriesService } from 'src/modules/categories';
import { InventoryService } from 'src/modules/inventory';
import { OrderStatus, OrdersService } from 'src/modules/orders';
import { ProductsService } from 'src/modules/products';
import { SettingsService } from 'src/modules/settings';
import { StoresService } from 'src/modules/stores';
import { UsersService } from 'src/modules/users/users.service';
import { AdminService } from './admin.service';

const STORE = new Types.ObjectId('64b000000000000000000001');
const CUSTOMER_ID = '64b000000000000000000010';
const MANAGER_ID = '64b000000000000000000011';

const ACTOR = { userId: '64b000000000000000000009', role: Role.ADMIN };

function userDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(CUSTOMER_ID),
    fullName: 'Ayesha Khan',
    phone: '+923001234599',
    email: 'ayesha@example.com',
    role: Role.CUSTOMER,
    isActive: true,
    preferredLanguage: 'EN',
    storeId: null,
    phoneVerifiedAt: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    // The two fields that must never cross the API boundary. They are
    // `select: false` on the schema; present here so a leak would be visible.
    passwordHash: '$2b$12$notarealhash',
    refreshTokenHash: 'not-a-real-token',
    ...overrides,
  };
}

function build(overrides: Record<string, Record<string, jest.Mock>> = {}) {
  const usersService = {
    list: jest.fn().mockResolvedValue({ items: [], pagination: {} }),
    findByIdOrFail: jest.fn().mockResolvedValue(userDoc()),
    setActive: jest.fn().mockResolvedValue(userDoc({ isActive: false })),
    create: jest.fn(),
    updateProfile: jest.fn(),
    assignStore: jest.fn(),
    countByRole: jest
      .fn()
      .mockResolvedValue({ customers: 40, activeCustomers: 38, storeManagers: 2, admins: 1 }),
    ...overrides.usersService,
  };

  const ordersService = {
    platformMetrics: jest.fn().mockResolvedValue({ ordersToday: 4, revenueToday: 5_600 }),
    customerOrderSummary: jest
      .fn()
      .mockResolvedValue({ orderCount: 7, totalSpent: 18_400, lastOrderAt: null }),
    ...overrides.ordersService,
  };

  const productsService = {
    countForStore: jest.fn().mockResolvedValue({ activeProducts: 52, inactiveProducts: 1 }),
  };

  const categoriesService = { countActive: jest.fn().mockResolvedValue(31) };

  const inventoryService = {
    countByStatus: jest.fn().mockResolvedValue({
      [StockStatus.IN_STOCK]: 48,
      [StockStatus.LOW_STOCK]: 3,
      [StockStatus.OUT_OF_STOCK]: 2,
    }),
  };

  const storesService = {
    getActiveStoreObjectId: jest.fn().mockResolvedValue(STORE),
    list: jest.fn().mockResolvedValue([
      { _id: STORE, name: 'FreshCarts Gulberg', isActive: true },
      { _id: new Types.ObjectId('64b000000000000000000002'), name: 'Johar Town', isActive: false },
    ]),
    isAcceptingOrders: jest
      .fn()
      .mockImplementation((store: { isActive: boolean }) => store.isActive),
    findByIdOrFail: jest.fn().mockResolvedValue({ _id: STORE, name: 'FreshCarts Gulberg' }),
    ...overrides.storesService,
  };

  const settingsService = {
    get: jest.fn().mockResolvedValue({ orderingEnabled: true, maxDeliveryDistanceMeters: 12_000 }),
  };

  const auditService = { record: jest.fn().mockResolvedValue(undefined) };

  const service = new AdminService(
    usersService as unknown as UsersService,
    ordersService as unknown as OrdersService,
    productsService as unknown as ProductsService,
    categoriesService as unknown as CategoriesService,
    inventoryService as unknown as InventoryService,
    storesService as unknown as StoresService,
    settingsService as unknown as SettingsService,
    auditService as unknown as AuditService,
  );

  return { service, usersService, ordersService, storesService, auditService, inventoryService };
}

describe('AdminService.dashboard', () => {
  it('composes every tile from one concurrent pass, not a request per tile', async () => {
    const { service, ordersService, inventoryService } = build();

    const dashboard = await service.dashboard();

    expect(ordersService.platformMetrics).toHaveBeenCalledTimes(1);
    expect(inventoryService.countByStatus).toHaveBeenCalledTimes(1);

    expect(dashboard.catalogue).toEqual({
      activeProducts: 52,
      inactiveProducts: 1,
      categories: 31,
    });
    expect(dashboard.inventory).toEqual({ inStock: 48, lowStock: 3, outOfStock: 2 });
    expect(dashboard.people).toEqual({ customers: 40, activeCustomers: 38, storeManagers: 2 });
  });

  it('scopes catalogue and stock figures to the active store', async () => {
    const { service, storesService } = build();

    await service.dashboard();

    expect(storesService.getActiveStoreObjectId).toHaveBeenCalled();
  });

  it('counts stores by both configuration and opening hours', async () => {
    const { service } = build();

    const dashboard = await service.dashboard();

    // Two stores exist, one is active, and only an active store can be open.
    expect(dashboard.stores).toEqual({ total: 2, active: 1, open: 1 });
  });

  it('does not report an admin headcount it was not asked for', async () => {
    // Section 4: only metrics that are actually used. The admin count is
    // available from countByRole and is deliberately not surfaced.
    const { service } = build();

    expect(await service.dashboard()).not.toHaveProperty('people.admins');
  });
});

describe('AdminService — customers', () => {
  it('pins the role server-side so the endpoint cannot return staff accounts', async () => {
    const { service, usersService } = build();

    await service.listCustomers({ page: 1, limit: 20, skip: 0 } as never);

    expect(usersService.list).toHaveBeenCalledWith(expect.anything(), Role.CUSTOMER);
  });

  it('never returns a password hash or a refresh token', async () => {
    const { service } = build({
      usersService: {
        list: jest.fn().mockResolvedValue({
          items: [
            {
              id: CUSTOMER_ID,
              fullName: 'Ayesha Khan',
              phone: '+923001234599',
              email: 'ayesha@example.com',
              role: Role.CUSTOMER,
              isActive: true,
              preferredLanguage: 'EN',
              phoneVerifiedAt: null,
              lastLoginAt: null,
              createdAt: new Date(),
            },
          ],
          pagination: {},
        }),
      },
    });

    const page = await service.listCustomers({ page: 1, limit: 20, skip: 0 } as never);
    const keys = Object.keys(page.items[0]);

    expect(keys).not.toContain('passwordHash');
    expect(keys).not.toContain('refreshTokenHash');
    // Narrower than PublicUser: no language preference, no verification stamp.
    expect(keys.sort()).toEqual([
      'createdAt',
      'email',
      'fullName',
      'id',
      'isActive',
      'lastLoginAt',
      'phone',
    ]);
  });

  it('reports a staff id as not found on the customer route', async () => {
    // A 404 rather than a 403, so the customer and staff lists cannot be used
    // to enumerate each other.
    const { service } = build({
      usersService: {
        findByIdOrFail: jest.fn().mockResolvedValue(userDoc({ role: Role.STORE_MANAGER })),
      },
    });

    await expect(service.findCustomer(CUSTOMER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports spend from the order aggregation, not from a counter on the account', async () => {
    const { service, ordersService } = build();

    const customer = await service.findCustomer(CUSTOMER_ID);

    expect(ordersService.customerOrderSummary).toHaveBeenCalled();
    expect(customer.orderCount).toBe(7);
    expect(customer.totalSpent).toBe(18_400);
  });

  it('records the deactivation in the audit trail', async () => {
    const { service, usersService, auditService } = build();

    await service.setCustomerStatus(ACTOR, CUSTOMER_ID, false);

    expect(usersService.setActive).toHaveBeenCalledWith(CUSTOMER_ID, false);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: ACTOR,
        action: AuditAction.USER_STATUS_CHANGED,
        entityId: CUSTOMER_ID,
      }),
    );
  });

  it('refuses to change the status of a non-customer through the customer route', async () => {
    const { service, usersService } = build({
      usersService: {
        findByIdOrFail: jest.fn().mockResolvedValue(userDoc({ role: Role.ADMIN })),
      },
    });

    await expect(service.setCustomerStatus(ACTOR, CUSTOMER_ID, false)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(usersService.setActive).not.toHaveBeenCalled();
  });
});

describe('AdminService — store managers', () => {
  const managerDoc = userDoc({
    _id: new Types.ObjectId(MANAGER_ID),
    role: Role.STORE_MANAGER,
    storeId: STORE,
    fullName: 'Bilal Ahmed',
  });

  it('creates the account through the shared auth path, with the role passed explicitly', async () => {
    const { service, usersService } = build({
      usersService: { create: jest.fn().mockResolvedValue(managerDoc) },
    });

    await service.createStoreManager(ACTOR, {
      fullName: 'Bilal Ahmed',
      phone: '+923001234568',
      password: 'Manager12345',
      storeId: STORE.toString(),
    });

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        role: Role.STORE_MANAGER,
        storeId: STORE.toString(),
        // Plain text in, hashed by PasswordService inside UsersService.create —
        // there is no second credential path.
        password: 'Manager12345',
      }),
    );
  });

  it('verifies the store exists before creating an account bound to it', async () => {
    const { service, usersService } = build({
      storesService: {
        findByIdOrFail: jest.fn().mockRejectedValue(new NotFoundException('Store not found')),
      },
    });

    await expect(
      service.createStoreManager(ACTOR, {
        fullName: 'Bilal Ahmed',
        phone: '+923001234568',
        password: 'Manager12345',
        storeId: '64b0000000000000000000ff',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    // A manager bound to a store that does not exist would authenticate and
    // then be able to do nothing.
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('never puts the password in the audit row', async () => {
    const { service, auditService } = build({
      usersService: { create: jest.fn().mockResolvedValue(managerDoc) },
    });

    await service.createStoreManager(ACTOR, {
      fullName: 'Bilal Ahmed',
      phone: '+923001234568',
      password: 'Manager12345',
      storeId: STORE.toString(),
    });

    const [event] = auditService.record.mock.calls[0];
    expect(JSON.stringify(event)).not.toContain('Manager12345');
    expect(event.metadata).toEqual({ storeName: 'FreshCarts Gulberg' });
  });

  it('reassigns a store through assignStore, which clears the refresh token', async () => {
    const { service, usersService } = build({
      usersService: {
        findByIdOrFail: jest.fn().mockResolvedValue(managerDoc),
        assignStore: jest.fn().mockResolvedValue(managerDoc),
      },
    });

    await service.updateStoreManager(ACTOR, MANAGER_ID, {
      storeId: '64b000000000000000000002',
    });

    expect(usersService.assignStore).toHaveBeenCalled();
  });

  it('refuses an edit that changes nothing rather than writing an empty audit row', async () => {
    const { service, auditService } = build({
      usersService: { findByIdOrFail: jest.fn().mockResolvedValue(managerDoc) },
    });

    await expect(service.updateStoreManager(ACTOR, MANAGER_ID, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('records that a name changed without recording the name itself', async () => {
    // Section 27: who did what to which resource, when. The old and new values
    // of a person's name are personal data the question does not require.
    const { service, auditService } = build({
      usersService: {
        findByIdOrFail: jest.fn().mockResolvedValue(managerDoc),
        updateProfile: jest.fn().mockResolvedValue(managerDoc),
      },
    });

    await service.updateStoreManager(ACTOR, MANAGER_ID, { fullName: 'Bilal A. Ahmed' });

    const [event] = auditService.record.mock.calls[0];
    expect(event.metadata).toEqual({ fullName: true });
    expect(JSON.stringify(event)).not.toContain('Bilal A. Ahmed');
  });

  it('reports a customer id as not found on the store-manager route', async () => {
    const { service } = build();

    await expect(service.findStoreManager(CUSTOMER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('has no route through which a role could be changed', () => {
    // Role changes are `PATCH /users/:id/role`, a separate named operation, so
    // one cannot happen as a side effect of an edit form (section 30).
    const updateSource = AdminService.prototype.updateStoreManager.toString();

    expect(updateSource).not.toContain('updateRole');
    expect(updateSource).not.toContain(OrderStatus.PENDING);
  });
});

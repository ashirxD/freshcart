import { Types } from 'mongoose';
import { StockStatus } from 'src/common/enums';
import { InventoryService } from 'src/modules/inventory';
import { OrderStatus, OrdersService } from 'src/modules/orders';
import { StoresService } from 'src/modules/stores';
import { SubstitutionsService } from 'src/modules/substitutions';
import { StoreManagerService } from './store-manager.service';

const STORE_A = new Types.ObjectId('64b000000000000000000001');

function zeroedStatuses(overrides: Partial<Record<OrderStatus, number>> = {}) {
  const byStatus = Object.values(OrderStatus).reduce(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    {} as Record<OrderStatus, number>,
  );

  return { ...byStatus, ...overrides };
}

describe('StoreManagerService', () => {
  let ordersService: jest.Mocked<Pick<OrdersService, 'dashboardCountsForStore' | 'findForStore'>>;
  let inventoryService: jest.Mocked<Pick<InventoryService, 'countByStatus'>>;
  let substitutionsService: jest.Mocked<
    Pick<SubstitutionsService, 'countOpenForStore' | 'listForStoreOrder'>
  >;
  let storesService: jest.Mocked<Pick<StoresService, 'findByIdOrFail' | 'isAcceptingOrders'>>;
  let service: StoreManagerService;

  beforeEach(() => {
    ordersService = {
      dashboardCountsForStore: jest.fn().mockResolvedValue({
        byStatus: zeroedStatuses({
          [OrderStatus.PENDING]: 5,
          [OrderStatus.CONFIRMED]: 3,
          [OrderStatus.PREPARING]: 4,
          [OrderStatus.PACKED]: 2,
          [OrderStatus.READY_FOR_PICKUP]: 2,
          [OrderStatus.OUT_FOR_DELIVERY]: 3,
        }),
        needsAction: 14,
        completedToday: 18,
      }),
      findForStore: jest.fn().mockResolvedValue({ id: 'order-1', orderNumber: 'FC-1' }),
    } as never;

    inventoryService = {
      countByStatus: jest.fn().mockResolvedValue({
        [StockStatus.IN_STOCK]: 51,
        [StockStatus.LOW_STOCK]: 7,
        [StockStatus.OUT_OF_STOCK]: 4,
      }),
    } as never;

    substitutionsService = {
      countOpenForStore: jest.fn().mockResolvedValue(2),
      listForStoreOrder: jest.fn().mockResolvedValue([{ id: 'sub-1' }]),
    } as never;

    storesService = {
      findByIdOrFail: jest.fn().mockResolvedValue({
        _id: STORE_A,
        name: 'FreshCarts Gulberg',
        address: { area: 'Gulberg III', city: 'Lahore' },
        isActive: true,
      }),
      isAcceptingOrders: jest.fn().mockReturnValue(true),
    } as never;

    service = new StoreManagerService(
      ordersService as unknown as OrdersService,
      inventoryService as unknown as InventoryService,
      substitutionsService as unknown as SubstitutionsService,
      storesService as unknown as StoresService,
    );
  });

  describe('dashboard', () => {
    it('asks each domain for its own numbers, scoped to the store', async () => {
      await service.dashboard(STORE_A);

      expect(ordersService.dashboardCountsForStore).toHaveBeenCalledWith(STORE_A);
      expect(inventoryService.countByStatus).toHaveBeenCalledWith(STORE_A);
      expect(substitutionsService.countOpenForStore).toHaveBeenCalledWith(STORE_A);
    });

    it('makes one call per domain, not one per tile', async () => {
      // §6: the whole summary is a handful of aggregations, because an
      // operations dashboard is refreshed constantly.
      await service.dashboard(STORE_A);

      expect(ordersService.dashboardCountsForStore).toHaveBeenCalledTimes(1);
      expect(inventoryService.countByStatus).toHaveBeenCalledTimes(1);
      expect(substitutionsService.countOpenForStore).toHaveBeenCalledTimes(1);
    });

    it('reports the operational counts the dashboard renders', async () => {
      const dashboard = await service.dashboard(STORE_A);

      expect(dashboard.orders).toEqual({
        pending: 5,
        confirmed: 3,
        preparing: 4,
        packed: 2,
        readyForPickup: 2,
        outForDelivery: 3,
        completedToday: 18,
        needsAction: 14,
      });
      expect(dashboard.inventory).toEqual({ inStock: 51, lowStock: 7, outOfStock: 4 });
      expect(dashboard.substitutions).toEqual({ awaitingCustomer: 2 });
    });

    it('reports whether the store is open, without acting on it', async () => {
      // §69: shown as information. Nothing here rejects orders on the strength
      // of it — checkout already owns that rule.
      const dashboard = await service.dashboard(STORE_A);

      expect(dashboard.store).toMatchObject({
        name: 'FreshCarts Gulberg',
        area: 'Gulberg III',
        isOpen: true,
      });
    });

    it('reports a closed store as closed', async () => {
      storesService.isAcceptingOrders.mockReturnValue(false);

      expect((await service.dashboard(STORE_A)).store.isOpen).toBe(false);
    });
  });

  describe('orderWithSubstitutions', () => {
    it('establishes store ownership through the order read before anything else', async () => {
      await service.orderWithSubstitutions(STORE_A, 'order-1');

      expect(ordersService.findForStore).toHaveBeenCalledWith(STORE_A, 'order-1');
    });

    it('does not read substitutions when the order is not the store’s', async () => {
      ordersService.findForStore.mockRejectedValue(new Error('Order not found'));

      await expect(service.orderWithSubstitutions(STORE_A, 'order-1')).rejects.toThrow();
      expect(substitutionsService.listForStoreOrder).not.toHaveBeenCalled();
    });

    it('composes the two reads the picking screen needs together', async () => {
      const result = await service.orderWithSubstitutions(STORE_A, 'order-1');

      expect(result).toMatchObject({ orderNumber: 'FC-1', substitutions: [{ id: 'sub-1' }] });
    });
  });
});

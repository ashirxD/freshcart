import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { StockStatus } from 'src/common/enums';
import { InventoryService } from 'src/modules/inventory';
import { OrderStatus, OrdersService, StoreOrderDetailView } from 'src/modules/orders';
import { StoresService } from 'src/modules/stores';
import { SubstitutionView, SubstitutionsService } from 'src/modules/substitutions';

/** The operational summary the dashboard renders. One request, one response. */
export interface StoreDashboard {
  store: {
    id: string;
    name: string;
    area: string;
    city: string;
    isActive: boolean;
    /** Whether the store is inside its opening hours right now. */
    isOpen: boolean;
  };
  orders: {
    pending: number;
    confirmed: number;
    preparing: number;
    packed: number;
    readyForPickup: number;
    outForDelivery: number;
    completedToday: number;
    /** Pending + confirmed + preparing + packed — what the store is holding up. */
    needsAction: number;
  };
  inventory: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
  };
  /** Proposals waiting on a customer's answer. */
  substitutions: { awaitingCustomer: number };
}

/** An order plus the proposals against it, which no single domain service owns. */
export interface StoreOrderWithSubstitutions extends StoreOrderDetailView {
  substitutions: SubstitutionView[];
}

/**
 * STORE MANAGER SERVICE — orchestration only
 * ==========================================
 *
 * §50 draws the line and this file stays on the right side of it. There is no
 * state machine here, no stock arithmetic, no product validation, no query
 * building. Every method below is one of exactly two things:
 *
 *   1. an aggregation across domains that no single domain owns (the dashboard),
 *   2. a composition of two domain reads that a screen needs together.
 *
 * Everything else on the store-manager surface goes straight from the controller
 * to OrdersService, InventoryService, ProductsService or SubstitutionsService —
 * deliberately not proxied through here, because a pass-through method is just a
 * place for logic to accumulate later.
 */
@Injectable()
export class StoreManagerService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly inventoryService: InventoryService,
    private readonly substitutionsService: SubstitutionsService,
    private readonly storesService: StoresService,
  ) {}

  /**
   * The whole dashboard in one round trip's worth of work.
   *
   * Four concurrent reads, each a single aggregation or count against an indexed
   * field — not one query per tile. §6 asks for exactly this, and the reason is
   * that an operations dashboard is refreshed constantly: a tile-per-request
   * design multiplies that traffic by eight for numbers that all come from the
   * same two collections.
   */
  async dashboard(storeId: Types.ObjectId): Promise<StoreDashboard> {
    const [store, orderCounts, stockCounts, awaitingCustomer] = await Promise.all([
      this.storesService.findByIdOrFail(storeId.toString()),
      this.ordersService.dashboardCountsForStore(storeId),
      this.inventoryService.countByStatus(storeId),
      this.substitutionsService.countOpenForStore(storeId),
    ]);

    return {
      store: {
        id: store._id.toString(),
        name: store.name,
        area: store.address.area,
        city: store.address.city,
        isActive: store.isActive,
        // §69: shown as information. Nothing here rejects orders on the strength
        // of it — that rule belongs to checkout, which already applies it.
        isOpen: this.storesService.isAcceptingOrders(store),
      },
      orders: {
        pending: orderCounts.byStatus[OrderStatus.PENDING],
        confirmed: orderCounts.byStatus[OrderStatus.CONFIRMED],
        preparing: orderCounts.byStatus[OrderStatus.PREPARING],
        packed: orderCounts.byStatus[OrderStatus.PACKED],
        readyForPickup: orderCounts.byStatus[OrderStatus.READY_FOR_PICKUP],
        outForDelivery: orderCounts.byStatus[OrderStatus.OUT_FOR_DELIVERY],
        completedToday: orderCounts.completedToday,
        needsAction: orderCounts.needsAction,
      },
      inventory: {
        inStock: stockCounts[StockStatus.IN_STOCK],
        lowStock: stockCounts[StockStatus.LOW_STOCK],
        outOfStock: stockCounts[StockStatus.OUT_OF_STOCK],
      },
      substitutions: { awaitingCustomer },
    };
  }

  /**
   * An order with its substitution proposals.
   *
   * Composed here rather than in OrdersService because substitutions depend on
   * orders; having the order service reach back for them would close the cycle
   * the module graph is arranged to avoid. The picking screen needs both at
   * once, so it gets both in one response instead of a second request.
   */
  async orderWithSubstitutions(
    storeId: Types.ObjectId,
    orderId: string,
  ): Promise<StoreOrderWithSubstitutions> {
    // The order read runs first and on its own: it establishes store ownership,
    // and a 404 from it must happen before anything else is fetched.
    const order = await this.ordersService.findForStore(storeId, orderId);
    const substitutions = await this.substitutionsService.listForStoreOrder(storeId, orderId);

    return { ...order, substitutions };
  }
}

import { OrderStatus } from './order-status.machine';
import { StoreOrderDetailView, StoreOrderSummaryView } from './store-order.view';

/**
 * THE ADMIN PROJECTION
 * ====================
 *
 * The store-facing view, plus the one fact staff never need and an admin always
 * does: which store the order belongs to. An admin's list spans every store, so
 * a row without its store is unreadable.
 *
 * It is a thin extension rather than a third mapper on purpose. Everything an
 * admin sees about an order — the items, the snapshotted prices, the address,
 * the payment, the status history — is exactly what the store sees, and a
 * separate mapper would be a second place for the customer-data projection in
 * `store-order.view.ts` to be widened by accident.
 *
 * Note what an admin does NOT gain here: no customer account, no email, no
 * order history for that shopper, no other address. Section 8 and section 21
 * both apply — elevated operational reach is not elevated access to personal
 * data.
 */
export interface AdminOrderStoreRef {
  id: string;
  name: string;
}

export interface AdminOrderSummaryView extends StoreOrderSummaryView {
  store: AdminOrderStoreRef;
}

export interface AdminOrderDetailView extends StoreOrderDetailView {
  store: AdminOrderStoreRef;
}

/** The platform-wide numbers the admin dashboard renders. */
export interface AdminOrderMetrics {
  ordersToday: number;
  /** Gross value of today's orders, excluding those that were never fulfilled. */
  revenueToday: number;
  ordersThisWeek: number;
  revenueThisWeek: number;
  pending: number;
  needsAction: number;
  outForDelivery: number;
  readyForPickup: number;
  byStatus: Record<OrderStatus, number>;
}

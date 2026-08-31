import { BusinessException } from 'src/common/errors';
import { ErrorCode } from 'src/common/errors';
import {
  CUSTOMER_CANCELLABLE_STATUSES,
  FulfillmentMethod,
  OrderStatus,
  assertCustomerCanCancel,
  assertTransition,
  canTransition,
  isCustomerCancellable,
  isTerminal,
  progressionFor,
} from './order-status.machine';

const { DELIVERY, PICKUP } = FulfillmentMethod;

describe('order status machine', () => {
  describe('the two lifecycles are genuinely separate', () => {
    it('never lets a pickup order go OUT_FOR_DELIVERY', () => {
      // The rule §8 calls out. It holds because the edge does not exist in the
      // pickup table, not because something checks for it afterwards.
      expect(canTransition(PICKUP, OrderStatus.PACKED, OrderStatus.OUT_FOR_DELIVERY)).toBe(false);
      expect(canTransition(PICKUP, OrderStatus.PACKED, OrderStatus.READY_FOR_PICKUP)).toBe(true);
    });

    it('never lets a delivery order go READY_FOR_PICKUP', () => {
      expect(canTransition(DELIVERY, OrderStatus.PACKED, OrderStatus.READY_FOR_PICKUP)).toBe(false);
      expect(canTransition(DELIVERY, OrderStatus.PACKED, OrderStatus.OUT_FOR_DELIVERY)).toBe(true);
    });

    it('walks the whole delivery progression', () => {
      const path = progressionFor(DELIVERY);

      expect(path).toEqual([
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.PACKED,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
      ]);

      for (let index = 0; index < path.length - 1; index += 1) {
        expect(canTransition(DELIVERY, path[index], path[index + 1])).toBe(true);
      }
    });

    it('walks the whole pickup progression', () => {
      const path = progressionFor(PICKUP);

      expect(path[4]).toBe(OrderStatus.READY_FOR_PICKUP);

      for (let index = 0; index < path.length - 1; index += 1) {
        expect(canTransition(PICKUP, path[index], path[index + 1])).toBe(true);
      }
    });
  });

  describe('invalid transitions', () => {
    it('refuses the jump a malicious client would try: PENDING straight to DELIVERED', () => {
      expect(canTransition(DELIVERY, OrderStatus.PENDING, OrderStatus.DELIVERED)).toBe(false);

      try {
        assertTransition(DELIVERY, OrderStatus.PENDING, OrderStatus.DELIVERED);
        fail('expected the transition to be refused');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).code).toBe(ErrorCode.INVALID_STATUS_TRANSITION);
      }
    });

    it('refuses to move backwards', () => {
      expect(canTransition(DELIVERY, OrderStatus.PACKED, OrderStatus.PREPARING)).toBe(false);
    });

    it('lets nothing follow a terminal state', () => {
      for (const terminal of [
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.REJECTED,
        OrderStatus.FAILED,
      ]) {
        expect(isTerminal(terminal)).toBe(true);

        for (const next of Object.values(OrderStatus)) {
          expect(canTransition(DELIVERY, terminal, next)).toBe(false);
          expect(canTransition(PICKUP, terminal, next)).toBe(false);
        }
      }
    });
  });

  describe('customer cancellation authority', () => {
    it('allows cancellation before the store starts picking', () => {
      for (const status of CUSTOMER_CANCELLABLE_STATUSES) {
        expect(() => assertCustomerCanCancel(status)).not.toThrow();
        expect(isCustomerCancellable(status)).toBe(true);
      }
    });

    it('refuses once preparation has begun, even though the edge exists', () => {
      // PREPARING -> CANCELLED is a legal transition for a store manager.
      // Authority and legality are separate axes, and this proves they are.
      expect(canTransition(DELIVERY, OrderStatus.PREPARING, OrderStatus.CANCELLED)).toBe(true);

      expect(() => assertCustomerCanCancel(OrderStatus.PREPARING)).toThrow(BusinessException);
      expect(isCustomerCancellable(OrderStatus.PREPARING)).toBe(false);
    });

    it('refuses to cancel a completed order', () => {
      try {
        assertCustomerCanCancel(OrderStatus.DELIVERED);
        fail('expected cancellation to be refused');
      } catch (error) {
        expect((error as BusinessException).code).toBe(ErrorCode.ORDER_NOT_CANCELLABLE);
        expect((error as BusinessException).message).toContain('already been completed');
      }
    });

    it('refuses to cancel an already-cancelled order', () => {
      expect(() => assertCustomerCanCancel(OrderStatus.CANCELLED)).toThrow(BusinessException);
    });
  });
});

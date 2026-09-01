import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from 'src/common/enums';
import { ErrorCode } from 'src/common/errors';
import { FulfillmentMethod, OrderStatus, assertTransition } from './order-status.machine';
import { OrdersService } from './orders.service';

const ORDER_ID = '64b000000000000000000021';
const ADMIN = { userId: '64b000000000000000000009', role: Role.ADMIN };

/**
 * THE ADMIN ORDER SURFACE
 * =======================
 *
 * Section 21 is explicit: elevated permission must not become
 * `order.status = arbitraryStatus`. What an admin gains over a store manager is
 * *reach* — any store — and nothing else. These tests are that claim, stated so
 * it cannot quietly stop being true.
 *
 * `overrideStatusForAdmin` is tested against a real OrdersService instance with
 * `changeStatus` stubbed, because the point being verified is what the override
 * method does BEFORE delegating: it requires a reason, and it hands the
 * transition to the one method that owns the state machine.
 */
describe('OrdersService.overrideStatusForAdmin', () => {
  function build() {
    const service = Object.create(OrdersService.prototype) as OrdersService;

    const changeStatus = jest.fn().mockResolvedValue({});
    const findForAdmin = jest.fn().mockResolvedValue({
      id: ORDER_ID,
      orderNumber: 'FC-2026-0000001',
      status: OrderStatus.CONFIRMED,
      store: { id: '64b000000000000000000001', name: 'FreshCarts Gulberg' },
    });

    Object.assign(service, { changeStatus, findForAdmin });

    return { service, changeStatus, findForAdmin };
  }

  it('routes the transition through changeStatus, which owns the state machine', async () => {
    const { service, changeStatus } = build();

    await service.overrideStatusForAdmin(
      ORDER_ID,
      OrderStatus.PREPARING,
      ADMIN,
      'Store phone is down; confirming on their behalf',
    );

    // The one call that matters. There is no direct status assignment anywhere
    // in the admin path — the machine still gets to refuse.
    expect(changeStatus).toHaveBeenCalledWith(
      new Types.ObjectId(ORDER_ID),
      OrderStatus.PREPARING,
      expect.objectContaining({ actor: Role.ADMIN }),
    );
  });

  it('requires a reason at every status, not only terminal ones', async () => {
    // Store staff must give a reason when rejecting, cancelling or failing. An
    // admin must give one always: acting outside the normal queue is by
    // definition something that needs explaining.
    const { service, changeStatus } = build();

    await expect(
      service.overrideStatusForAdmin(ORDER_ID, OrderStatus.PREPARING, ADMIN, '   '),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(changeStatus).not.toHaveBeenCalled();
  });

  it('puts the reason in the customer-facing timeline note', async () => {
    const { service, changeStatus } = build();

    await service.overrideStatusForAdmin(
      ORDER_ID,
      OrderStatus.CANCELLED,
      ADMIN,
      'Store closed unexpectedly',
    );

    expect(changeStatus).toHaveBeenCalledWith(
      expect.anything(),
      OrderStatus.CANCELLED,
      expect.objectContaining({
        note: 'Store closed unexpectedly',
        cancellationReason: 'Store closed unexpectedly',
      }),
    );
  });

  it('records a cancellation reason only for terminal statuses', async () => {
    const { service, changeStatus } = build();

    await service.overrideStatusForAdmin(
      ORDER_ID,
      OrderStatus.PACKED,
      ADMIN,
      'Packed by area lead',
    );

    expect(changeStatus).toHaveBeenCalledWith(
      expect.anything(),
      OrderStatus.PACKED,
      expect.objectContaining({ cancellationReason: undefined }),
    );
  });

  it('attributes the change to the verified principal', async () => {
    const { service, changeStatus } = build();

    await service.overrideStatusForAdmin(
      ORDER_ID,
      OrderStatus.PACKED,
      ADMIN,
      'Packed by area lead',
    );

    expect(changeStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ actorId: new Types.ObjectId(ADMIN.userId) }),
    );
  });

  it('rejects a malformed id as not found rather than throwing a cast error', async () => {
    const { service, changeStatus } = build();

    await expect(
      service.overrideStatusForAdmin('not-an-id', OrderStatus.PACKED, ADMIN, 'reason'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(changeStatus).not.toHaveBeenCalled();
  });
});

/**
 * The transitions an admin override is still refused, proven against the
 * machine itself — the same function `changeStatus` calls. An admin reaching
 * any of these gets the same 409 a store manager would.
 */
describe('the state machine still binds an admin', () => {
  it('refuses to revive a cancelled order', () => {
    expect(() =>
      assertTransition(FulfillmentMethod.DELIVERY, OrderStatus.CANCELLED, OrderStatus.DELIVERED),
    ).toThrow(expect.objectContaining({ code: ErrorCode.INVALID_STATUS_TRANSITION }));
  });

  it('refuses to cancel a delivered order', () => {
    expect(() =>
      assertTransition(FulfillmentMethod.DELIVERY, OrderStatus.DELIVERED, OrderStatus.CANCELLED),
    ).toThrow(expect.objectContaining({ code: ErrorCode.INVALID_STATUS_TRANSITION }));
  });

  it('refuses to send a pickup order out for delivery', () => {
    expect(() =>
      assertTransition(FulfillmentMethod.PICKUP, OrderStatus.PACKED, OrderStatus.OUT_FOR_DELIVERY),
    ).toThrow(expect.objectContaining({ code: ErrorCode.INVALID_STATUS_TRANSITION }));
  });

  it('refuses to mark a delivery order ready for pickup', () => {
    expect(() =>
      assertTransition(
        FulfillmentMethod.DELIVERY,
        OrderStatus.PACKED,
        OrderStatus.READY_FOR_PICKUP,
      ),
    ).toThrow(expect.objectContaining({ code: ErrorCode.INVALID_STATUS_TRANSITION }));
  });

  it('refuses to skip a step', () => {
    expect(() =>
      assertTransition(FulfillmentMethod.DELIVERY, OrderStatus.PENDING, OrderStatus.DELIVERED),
    ).toThrow(expect.objectContaining({ code: ErrorCode.INVALID_STATUS_TRANSITION }));
  });
});

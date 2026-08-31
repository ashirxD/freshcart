import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeOrderDetail } from '@/test/fixtures';
import { renderWithProviders, signIn } from '@/test/render';
import { OrderDetailScreen } from './order-detail-screen';
import type { OrderDetail } from '@/types/order';

function stubOrder(order: OrderDetail | Record<string, unknown>, status = 200) {
  const requests: Array<{ url: string; method: string; body: unknown }> = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });

      return new Response(JSON.stringify(order), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );

  return requests;
}

describe('OrderDetailScreen', () => {
  beforeEach(() => signIn());

  it('shows everything §36 asks for on a delivery order', async () => {
    stubOrder(makeOrderDetail());

    renderWithProviders(<OrderDetailScreen orderId="order-1" />);

    // Order number, date, status
    expect(await screen.findByRole('heading', { name: 'FC-2026-0001482' })).toBeInTheDocument();
    expect(screen.getByText(/placed 1 feb 2026/i)).toBeInTheDocument();
    expect(screen.getAllByText('Order placed').length).toBeGreaterThan(0);

    // Items with quantities and prices
    expect(screen.getByText('Olper’s Full Cream Milk')).toBeInTheDocument();
    expect(screen.getByText(/Rs\. 340 × 2/)).toBeInTheDocument();

    // Money
    expect(screen.getByText('Rs. 1,830')).toBeInTheDocument();
    expect(screen.getByText('Rs. 120')).toBeInTheDocument();
    expect(screen.getByText('Rs. 1,950')).toBeInTheDocument();

    // Address snapshot and payment
    expect(screen.getByText('42-B, Street 4, Salamatpura, Lahore')).toBeInTheDocument();
    expect(screen.getByText('Ring the bell twice')).toBeInTheDocument();
    expect(screen.getByText('Cash on delivery')).toBeInTheDocument();
    expect(screen.getByText('Payment due')).toBeInTheDocument();
  });

  it('renders the timeline from the server’s own steps', async () => {
    stubOrder(makeOrderDetail());

    renderWithProviders(<OrderDetailScreen orderId="order-1" />);

    const tracking = await screen.findByRole('region', { name: /order progress/i });
    expect(within(tracking).getByText('Out for delivery')).toBeInTheDocument();
    expect(within(tracking).getByText('In progress')).toBeInTheDocument();
  });

  it('shows pickup details and no delivery charge for a pickup order', async () => {
    stubOrder(
      makeOrderDetail({
        fulfillmentMethod: 'PICKUP',
        deliveryAddress: null,
        delivery: null,
        pricing: { subtotal: 1830, deliveryFee: 0, discount: 0, total: 1830, currency: 'PKR' },
        pickup: {
          storeName: 'FreshCarts Gulberg',
          storeAddress: 'Shop 12, Main Boulevard, Gulberg III, Lahore',
          storePhone: '+923004567890',
          instructions: 'Please bring your order number.',
        },
        timeline: [
          {
            status: 'PACKED',
            label: 'Packed',
            isComplete: true,
            isCurrent: false,
            changedAt: '2026-02-01T11:00:00.000Z',
            note: null,
          },
          {
            status: 'READY_FOR_PICKUP',
            label: 'Ready for pickup',
            isComplete: false,
            isCurrent: true,
            changedAt: '2026-02-01T12:00:00.000Z',
            note: 'Your order is ready to collect from the store.',
          },
        ],
      }),
    );

    renderWithProviders(<OrderDetailScreen orderId="order-1" />);

    expect(await screen.findByText('FreshCarts Gulberg')).toBeInTheDocument();
    expect(screen.getByText('Ready for pickup')).toBeInTheDocument();
    expect(screen.getByText('No charge')).toBeInTheDocument();
    expect(screen.queryByText(/42-B/)).not.toBeInTheDocument();
  });

  describe('cancellation', () => {
    it('offers cancellation only when the server says it is allowed', async () => {
      stubOrder(
        makeOrderDetail({ canCancel: false, status: 'PREPARING', statusLabel: 'Preparing' }),
      );

      renderWithProviders(<OrderDetailScreen orderId="order-1" />);

      await screen.findByRole('heading', { name: 'FC-2026-0001482' });
      // The client never re-derives the rule; it renders the server's answer.
      expect(screen.queryByRole('button', { name: /cancel this order/i })).not.toBeInTheDocument();
    });

    it('confirms before cancelling, rather than acting on one tap', async () => {
      stubOrder(makeOrderDetail());

      renderWithProviders(<OrderDetailScreen orderId="order-1" />);

      await userEvent.click(await screen.findByRole('button', { name: /cancel this order/i }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/this cannot be undone/i)).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: /keep my order/i })).toBeInTheDocument();
    });

    it('sends the cancellation with the reason the shopper gave', async () => {
      const requests = stubOrder(makeOrderDetail());

      renderWithProviders(<OrderDetailScreen orderId="order-1" />);

      await userEvent.click(await screen.findByRole('button', { name: /cancel this order/i }));
      await userEvent.type(
        await screen.findByLabelText(/why are you cancelling/i),
        'Ordered by mistake',
      );
      await userEvent.click(screen.getByRole('button', { name: /yes, cancel it/i }));

      await waitFor(() => {
        const cancel = requests.find((request) => request.url.includes('/cancel'));
        expect(cancel?.body).toEqual({ reason: 'Ordered by mistake' });
      });
    });
  });

  it('shows a useful failure rather than a blank screen', async () => {
    stubOrder({ statusCode: 404, message: 'Order not found', error: 'Not Found' }, 404);

    renderWithProviders(<OrderDetailScreen orderId="missing" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/order not found/i);
  });
});

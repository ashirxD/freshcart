import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { makeOrderSummary } from '@/test/fixtures';
import { renderWithProviders, signIn, signOut } from '@/test/render';
import { OrdersScreen } from './orders-screen';
import type { OrderSummary } from '@/types/order';

function stubOrders(items: OrderSummary[], total = items.length, totalPages = 1) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ items, pagination: { page: 1, limit: 10, total, totalPages } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    ),
  );
}

describe('OrdersScreen', () => {
  beforeEach(() => signIn());

  it('lists the shopper’s orders', async () => {
    stubOrders([
      makeOrderSummary(),
      makeOrderSummary({
        id: 'order-2',
        orderNumber: 'FC-2026-0001483',
        fulfillmentMethod: 'PICKUP',
        status: 'DELIVERED',
        statusLabel: 'Collected',
        canCancel: false,
      }),
    ]);

    renderWithProviders(<OrdersScreen />);

    expect(await screen.findByText('FC-2026-0001482')).toBeInTheDocument();
    expect(screen.getByText('FC-2026-0001483')).toBeInTheDocument();
    // The server's wording for each journey: a pickup is "collected".
    expect(screen.getByText('Collected')).toBeInTheDocument();
  });

  it('offers a way to start shopping when there are no orders', async () => {
    stubOrders([]);

    renderWithProviders(<OrdersScreen />);

    expect(await screen.findByText(/no orders yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start shopping/i })).toBeInTheDocument();
  });

  it('pages rather than pulling every order at once', async () => {
    stubOrders([makeOrderSummary()], 25, 3);

    renderWithProviders(<OrdersScreen />);

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    // Nothing newer than page one exists, so that direction is closed off.
    expect(screen.getByRole('button', { name: /newer/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /older/i })).toBeEnabled();
  });

  it('hides the pager when everything fits on one page', async () => {
    stubOrders([makeOrderSummary()]);

    renderWithProviders(<OrdersScreen />);

    await screen.findByText('FC-2026-0001482');
    expect(
      screen.queryByRole('navigation', { name: /order history pages/i }),
    ).not.toBeInTheDocument();
  });

  it('asks a signed-out visitor to sign in rather than showing an error', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    signOut();

    renderWithProviders(<OrdersScreen />);

    expect(await screen.findByText(/sign in to see your orders/i)).toBeInTheDocument();
    // The screen never fires a request it already knows would 401 — that would
    // burn the API client's refresh-and-retry path on an unrecoverable case.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

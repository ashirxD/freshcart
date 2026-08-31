import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  makeAddress,
  makeDeliveryPreview,
  makeOrderDetail,
  makePickupPreview,
} from '@/test/fixtures';
import { renderWithProviders, signIn } from '@/test/render';
import { CheckoutScreen } from './checkout-screen';
import type { Cart } from '@/types/cart';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

function makeCart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: 'cart-1',
    items: [],
    itemCount: 2,
    totalQuantity: 3,
    subtotal: 1830,
    hasIssues: false,
    updatedAt: '2026-02-01T09:00:00.000Z',
    ...overrides,
  };
}

interface RouteMap {
  cart?: unknown;
  addresses?: unknown;
  paymentMethods?: unknown;
  preview?: unknown;
  previewStatus?: number;
  order?: unknown;
  orderStatus?: number;
}

/**
 * Routes stubbed fetch calls by URL and method, and records every request so a
 * test can assert on what was actually sent — which is how the "no price in the
 * request" and "same idempotency key" claims are checked.
 */
function stubApi(routes: RouteMap) {
  const requests: Array<{ url: string; method: string; body: unknown; headers: Headers }> = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;

    requests.push({ url, method, body, headers });

    const json = (payload: unknown, status = 200) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });

    if (url.includes('/cart') && method === 'GET') return json(routes.cart ?? makeCart());
    if (url.includes('/addresses')) return json(routes.addresses ?? [makeAddress()]);
    if (url.includes('/payments/methods')) {
      return json(
        routes.paymentMethods ?? [{ method: 'CASH_ON_DELIVERY', label: 'Cash on delivery' }],
      );
    }
    if (url.includes('/checkout/preview')) {
      return json(routes.preview ?? makeDeliveryPreview(), routes.previewStatus ?? 200);
    }
    if (url.includes('/orders') && method === 'POST') {
      return json(routes.order ?? makeOrderDetail(), routes.orderStatus ?? 201);
    }

    return json({}, 404);
  });

  vi.stubGlobal('fetch', fetchMock);
  return { requests, fetchMock };
}

const orderRequests = (requests: ReturnType<typeof stubApi>['requests']) =>
  requests.filter((request) => request.url.includes('/orders') && request.method === 'POST');

/**
 * The screen renders its primary action twice — once in the desktop sidebar,
 * once in the mobile sticky bar — with the other hidden by `display: none` at
 * each breakpoint. jsdom applies no CSS, so both are present here; either one
 * drives the same handler, so the tests use the first.
 */
async function clickContinue() {
  await userEvent.click((await screen.findAllByRole('button', { name: /^continue$/i }))[0]);
}

async function clickPlaceOrder() {
  await userEvent.click((await screen.findAllByRole('button', { name: /place order/i }))[0]);
}

describe('CheckoutScreen', () => {
  beforeEach(() => {
    push.mockClear();
    signIn();
  });

  it('starts on the fulfilment step', async () => {
    stubApi({});
    renderWithProviders(<CheckoutScreen />);

    expect(
      await screen.findByRole('group', { name: /how would you like to receive your order/i }),
    ).toBeInTheDocument();
  });

  describe('the delivery journey', () => {
    it('walks method → address → payment → review and shows the fee before the order', async () => {
      const { requests } = stubApi({});
      renderWithProviders(<CheckoutScreen />);

      await clickContinue();

      // Address step: pick the saved address.
      await userEvent.click(await screen.findByRole('radio', { name: /42-B/ }));

      // The preview is only requested once an address exists (§59) — before
      // that there is nothing to route to.
      await waitFor(() =>
        expect(requests.some((request) => request.url.includes('/checkout/preview'))).toBe(true),
      );

      await clickContinue();

      // Payment step.
      expect(await screen.findByRole('radio', { name: /cash on delivery/i })).toBeChecked();
      await clickContinue();

      // Review: the delivery charge and the total are both on screen.
      expect(
        await screen.findByRole('heading', { name: /review your order/i }),
      ).toBeInTheDocument();
      expect(screen.getAllByText('Rs. 120').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Rs. 1,950').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/4\.3 km/).length).toBeGreaterThan(0);
    });

    it('asks for no preview until an address is chosen', async () => {
      const { requests } = stubApi({});
      renderWithProviders(<CheckoutScreen />);

      await screen.findByRole('group', { name: /how would you like to receive/i });
      await clickContinue();
      await screen.findByRole('radio', { name: /42-B/ });

      // §59: routing costs money per request, and a preview with no destination
      // could not be answered anyway.
      expect(requests.some((request) => request.url.includes('/checkout/preview'))).toBe(false);
    });

    it('will not advance past the address step with nothing chosen', async () => {
      stubApi({ addresses: [makeAddress({ isDefault: false })] });
      renderWithProviders(<CheckoutScreen />);

      await clickContinue();
      await screen.findByRole('radio', { name: /42-B/ });
      await clickContinue();

      expect(await screen.findByRole('alert')).toHaveTextContent(/choose a delivery address/i);
    });
  });

  describe('the pickup journey', () => {
    it('skips the address step entirely and shows the store', async () => {
      stubApi({ preview: makePickupPreview() });
      renderWithProviders(<CheckoutScreen />);

      await userEvent.click(
        await screen.findByRole('radio', { name: /collect it from the store/i }),
      );
      await clickContinue();

      // Straight to payment — no address step in the pickup flow.
      expect(await screen.findByRole('radio', { name: /cash on delivery/i })).toBeInTheDocument();
      await clickContinue();

      expect(await screen.findByText('FreshCarts Gulberg')).toBeInTheDocument();
      expect(screen.getByText(/Shop 12, Main Boulevard/)).toBeInTheDocument();
      expect(screen.getAllByText('No charge').length).toBeGreaterThan(0);
    });
  });

  describe('placing the order', () => {
    async function reachReview() {
      const api = stubApi({});
      renderWithProviders(<CheckoutScreen />);

      await clickContinue();
      await userEvent.click(await screen.findByRole('radio', { name: /42-B/ }));
      await clickContinue();
      await screen.findByRole('radio', { name: /cash on delivery/i });
      await clickContinue();
      await screen.findByRole('heading', { name: /review your order/i });

      return api;
    }

    it('sends only the choices — never a price, a fee or a total', async () => {
      const { requests } = await reachReview();

      await clickPlaceOrder();

      await waitFor(() => expect(orderRequests(requests)).toHaveLength(1));

      const body = orderRequests(requests)[0].body as Record<string, unknown>;
      expect(body).toEqual({
        fulfillmentMethod: 'DELIVERY',
        addressId: 'addr-1',
        paymentMethod: 'CASH_ON_DELIVERY',
        customerNote: undefined,
      });

      // §1 and §60: none of these has anywhere to travel.
      for (const forbidden of ['total', 'subtotal', 'deliveryFee', 'price', 'status', 'items']) {
        expect(body).not.toHaveProperty(forbidden);
      }
    });

    it('sends an idempotency key', async () => {
      const { requests } = await reachReview();

      await clickPlaceOrder();

      await waitFor(() => expect(orderRequests(requests)).toHaveLength(1));
      expect(orderRequests(requests)[0].headers.get('Idempotency-Key')).toMatch(
        /^[A-Za-z0-9._:-]{8,100}$/,
      );
    });

    it('sends the SAME key when the button is tapped twice', async () => {
      const { requests } = await reachReview();

      const button = screen.getAllByRole('button', { name: /place order/i })[0];

      // The double-tap §33 describes. Even if both reach the server, the second
      // is answered with the order the first created.
      await userEvent.click(button);
      await userEvent.click(button);

      await waitFor(() => expect(orderRequests(requests).length).toBeGreaterThanOrEqual(1));

      const keys = new Set(
        orderRequests(requests).map((request) => request.headers.get('Idempotency-Key')),
      );
      expect(keys.size).toBe(1);
    });

    it('goes to the confirmation screen on success', async () => {
      await reachReview();

      await clickPlaceOrder();

      await waitFor(() => expect(push).toHaveBeenCalledWith('/checkout/confirmation/order-1'));
    });
  });

  describe('when things go wrong', () => {
    it('shows the price-change screen with both prices and a way forward', async () => {
      stubApi({
        previewStatus: 409,
        preview: {
          statusCode: 409,
          message: 'Some prices changed since you added these items.',
          error: 'Conflict',
          code: 'CHECKOUT_VALIDATION_FAILED',
          details: {
            requiresPriceAcceptance: true,
            issues: [
              {
                code: 'PRICE_CHANGED',
                productId: 'p1',
                productName: 'Milk 1L',
                message: 'The price of Milk 1L changed from Rs. 320 to Rs. 340.',
                previousPrice: 320,
                currentPrice: 340,
              },
            ],
          },
        },
      });

      renderWithProviders(<CheckoutScreen />);

      await clickContinue();
      await userEvent.click(await screen.findByRole('radio', { name: /42-B/ }));

      // The heading and the server's message both say it; either is enough.
      expect(
        await screen.findByRole('heading', { name: /some prices changed/i }),
      ).toBeInTheDocument();
      expect(screen.getByText('Rs. 320')).toBeInTheDocument();
      expect(screen.getByText('Rs. 340')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /continue at the new prices/i }),
      ).toBeInTheDocument();
    });

    it('shows the out-of-area screen with the distances', async () => {
      stubApi({
        previewStatus: 409,
        preview: {
          statusCode: 409,
          message: 'That address is outside our delivery area.',
          error: 'Conflict',
          code: 'DELIVERY_UNAVAILABLE',
          details: { distanceMeters: 14200, maxDistanceMeters: 12000 },
        },
      });

      renderWithProviders(<CheckoutScreen />);

      await clickContinue();
      await userEvent.click(await screen.findByRole('radio', { name: /42-B/ }));

      expect(await screen.findByText(/we cannot deliver there/i)).toBeInTheDocument();
      expect(screen.getByText(/14\.2 km from the store/)).toBeInTheDocument();
    });

    it('shows a stock problem with a route back to the cart', async () => {
      stubApi({
        previewStatus: 409,
        preview: {
          statusCode: 409,
          message: 'Only 2 of Eggs are available now. Please lower the quantity.',
          error: 'Conflict',
          code: 'CHECKOUT_VALIDATION_FAILED',
          details: {
            requiresPriceAcceptance: false,
            issues: [
              {
                code: 'INSUFFICIENT_STOCK',
                productId: 'p2',
                productName: 'Eggs',
                message: 'Only 2 of Eggs are available now. Please lower the quantity.',
                availableQuantity: 2,
                requestedQuantity: 5,
              },
            ],
          },
        },
      });

      renderWithProviders(<CheckoutScreen />);

      await clickContinue();
      await userEvent.click(await screen.findByRole('radio', { name: /42-B/ }));

      expect(await screen.findByText(/only 2 of eggs are available/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /go to my cart/i })).toBeInTheDocument();
    });
  });

  describe('gates', () => {
    it('asks an empty cart to go shopping instead of checking out', async () => {
      stubApi({ cart: makeCart({ itemCount: 0, totalQuantity: 0, subtotal: 0 }) });

      renderWithProviders(<CheckoutScreen />);

      expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /start shopping/i })).toBeInTheDocument();
    });
  });
});

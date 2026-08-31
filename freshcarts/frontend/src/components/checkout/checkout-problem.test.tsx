import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api/errors';
import { renderWithProviders } from '@/test/render';
import { CheckoutProblem } from './checkout-problem';

/** Builds the error shape the API actually produces for a business failure. */
function businessError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  status = 409,
) {
  return new ApiError(status, message, [message], code as never, details);
}

describe('CheckoutProblem', () => {
  describe('price changes (§46)', () => {
    const priceChange = businessError(
      'CHECKOUT_VALIDATION_FAILED',
      'Some prices changed since you added these items. Please review them before placing your order.',
      {
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
    );

    it('shows both the old and the new price rather than silently charging', () => {
      renderWithProviders(<CheckoutProblem error={priceChange} onAcceptPrices={vi.fn()} />);

      expect(screen.getByText('Milk 1L')).toBeInTheDocument();
      expect(screen.getByText('Rs. 320')).toBeInTheDocument();
      expect(screen.getByText('Rs. 340')).toBeInTheDocument();
    });

    it('offers the shopper a way to accept the new prices', async () => {
      const onAcceptPrices = vi.fn();
      renderWithProviders(<CheckoutProblem error={priceChange} onAcceptPrices={onAcceptPrices} />);

      await userEvent.click(screen.getByRole('button', { name: /continue at the new prices/i }));

      expect(onAcceptPrices).toHaveBeenCalledOnce();
    });

    it('also offers a route back to the cart, so it is not a dead end', () => {
      renderWithProviders(<CheckoutProblem error={priceChange} onAcceptPrices={vi.fn()} />);

      expect(screen.getByRole('link', { name: /review my cart/i })).toHaveAttribute(
        'href',
        '/cart',
      );
    });

    it('marks a price that went down differently from one that went up', () => {
      const cheaper = businessError('CHECKOUT_VALIDATION_FAILED', 'Some prices changed.', {
        requiresPriceAcceptance: true,
        issues: [
          {
            code: 'PRICE_CHANGED',
            productId: 'p1',
            productName: 'Milk 1L',
            message: 'x',
            previousPrice: 340,
            currentPrice: 300,
          },
        ],
      });

      renderWithProviders(<CheckoutProblem error={cheaper} onAcceptPrices={vi.fn()} />);

      expect(screen.getByText('Rs. 300')).toHaveClass('text-success');
    });
  });

  describe('stock changes (§47)', () => {
    it('shows the server’s message naming the product and the quantity left', () => {
      const stockError = businessError(
        'CHECKOUT_VALIDATION_FAILED',
        'Only 2 of Eggs are available now. Please lower the quantity.',
        {
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
      );

      renderWithProviders(<CheckoutProblem error={stockError} onAcceptPrices={vi.fn()} />);

      expect(screen.getByText(/only 2 of eggs are available now/i)).toBeInTheDocument();
      // Not an "accept prices" situation — the cart itself has to change.
      expect(
        screen.queryByRole('button', { name: /continue at the new prices/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /go to my cart/i })).toBeInTheDocument();
    });
  });

  describe('delivery area (§24)', () => {
    it('explains the refusal with both distances', () => {
      const outOfArea = businessError(
        'DELIVERY_UNAVAILABLE',
        'That address is outside our delivery area. You can still collect this order from the store.',
        { distanceMeters: 14200, maxDistanceMeters: 12000 },
      );

      renderWithProviders(<CheckoutProblem error={outOfArea} />);

      expect(screen.getByText(/14\.2 km from the store/)).toBeInTheDocument();
      expect(screen.getByText(/we deliver up to 12\.0 km/i)).toBeInTheDocument();
    });
  });

  describe('other failures', () => {
    it('sends a shopper with an ungeocoded address to their address book', () => {
      const noCoordinates = businessError(
        'ADDRESS_COORDINATES_REQUIRED',
        'This address has no map location yet.',
        undefined,
        400,
      );

      renderWithProviders(<CheckoutProblem error={noCoordinates} />);

      expect(screen.getByRole('link', { name: /manage my addresses/i })).toHaveAttribute(
        'href',
        '/addresses',
      );
    });

    it('tells a shopper with a duplicate request where to look instead of retrying', () => {
      const duplicate = businessError(
        'DUPLICATE_REQUEST',
        'That order is already being placed. Please wait a moment before trying again.',
      );

      renderWithProviders(<CheckoutProblem error={duplicate} />);

      expect(screen.getByRole('link', { name: /check my orders/i })).toHaveAttribute(
        'href',
        '/orders',
      );
    });

    it('reports a lost connection as such, with a retry', async () => {
      const onRetry = vi.fn();
      const offline = new ApiError(0, 'We could not reach FreshCarts.');

      renderWithProviders(<CheckoutProblem error={offline} onRetry={onRetry} />);

      expect(screen.getByText(/you appear to be offline/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /try again/i }));
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it('never shows a 5xx message to a shopper', () => {
      const serverError = new ApiError(500, 'Cannot read property foo of undefined');

      renderWithProviders(<CheckoutProblem error={serverError} />);

      expect(screen.queryByText(/cannot read property/i)).not.toBeInTheDocument();
      expect(screen.getByText(/nothing has been charged/i)).toBeInTheDocument();
    });

    it('announces every failure, so it is not missed by a screen-reader user', () => {
      renderWithProviders(
        <CheckoutProblem
          error={businessError('CART_EMPTY', 'Your cart is empty.', undefined, 400)}
        />,
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

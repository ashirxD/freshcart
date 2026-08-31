import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { makeOrderSummary } from '@/test/fixtures';
import { OrderCard } from './order-card';

describe('OrderCard', () => {
  it('shows everything §35 asks a history row to show', () => {
    render(<OrderCard order={makeOrderSummary()} />);

    expect(screen.getByText('FC-2026-0001482')).toBeInTheDocument();
    expect(screen.getByText('1 Feb 2026')).toBeInTheDocument();
    expect(screen.getByText('Order placed')).toBeInTheDocument();
    expect(screen.getByText('3 items')).toBeInTheDocument();
    expect(screen.getByText(/Rs\. 1,950/)).toBeInTheDocument();
    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.getByText('FreshCarts Gulberg')).toBeInTheDocument();
  });

  it('names the products from the order’s own snapshot', () => {
    render(<OrderCard order={makeOrderSummary()} />);

    // Snapshotted at purchase, so this row still reads correctly for a product
    // that has since been renamed or withdrawn from the catalogue.
    expect(screen.getByText(/Olper’s Full Cream Milk, Tapal Danedar Tea/)).toBeInTheDocument();
  });

  it('says how many more items there are than it lists', () => {
    const order = makeOrderSummary({
      itemCount: 7,
      previewItems: [
        { productName: 'Milk', productImage: null, quantity: 1 },
        { productName: 'Eggs', productImage: null, quantity: 1 },
        { productName: 'Bread', productImage: null, quantity: 1 },
      ],
    });

    render(<OrderCard order={order} />);

    expect(screen.getByText(/and 4 more/)).toBeInTheDocument();
  });

  it('distinguishes a pickup order from a delivery one', () => {
    render(<OrderCard order={makeOrderSummary({ fulfillmentMethod: 'PICKUP' })} />);

    expect(screen.getByText('Pickup')).toBeInTheDocument();
    expect(screen.queryByText('Delivery')).not.toBeInTheDocument();
  });

  it('shows the payment state', () => {
    render(<OrderCard order={makeOrderSummary({ paymentStatus: 'PAID' })} />);

    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('says "1 item" rather than "1 items"', () => {
    render(<OrderCard order={makeOrderSummary({ totalQuantity: 1 })} />);

    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  it('is a single link to the order, so it is one tab stop', () => {
    render(<OrderCard order={makeOrderSummary()} />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/orders/order-1');
  });

  it('exposes no internal or operational detail', () => {
    const { container } = render(<OrderCard order={makeOrderSummary()} />);

    // §35: a customer row is not an admin row.
    expect(container.textContent).not.toMatch(/storeId|userId|changedByRole/i);
  });
});

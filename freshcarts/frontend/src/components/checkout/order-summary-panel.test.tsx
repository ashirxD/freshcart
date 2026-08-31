import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { makeDeliveryPreview, makePickupPreview } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { OrderSummaryPanel, formatDistance, formatDuration } from './order-summary-panel';

describe('OrderSummaryPanel', () => {
  it('shows the delivery charge as its own line, never hidden', () => {
    // §20 and §42: the fee must be visible before the order is placed, and it
    // must be a line the shopper can see, not folded into the total.
    renderWithProviders(<OrderSummaryPanel preview={makeDeliveryPreview()} />);

    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.getByText('Rs. 120')).toBeInTheDocument();
  });

  it('shows the distance beside the delivery line', () => {
    renderWithProviders(<OrderSummaryPanel preview={makeDeliveryPreview()} />);

    expect(screen.getByText(/4\.3 km/)).toBeInTheDocument();
  });

  it('renders the server’s subtotal and total, not a recomputed one', () => {
    // Deliberately inconsistent figures: if the component were doing its own
    // arithmetic it would "correct" them, and this test would fail.
    const preview = makeDeliveryPreview({ subtotal: 2500, deliveryFee: 120, total: 2620 });

    renderWithProviders(<OrderSummaryPanel preview={preview} />);

    expect(screen.getByText('Rs. 2,500')).toBeInTheDocument();
    expect(screen.getByText('Rs. 2,620')).toBeInTheDocument();
  });

  it('never claims free delivery for a pickup — it says there is no charge', () => {
    renderWithProviders(<OrderSummaryPanel preview={makePickupPreview()} />);

    expect(screen.getByText('No charge')).toBeInTheDocument();
    expect(screen.queryByText(/free delivery/i)).not.toBeInTheDocument();
  });

  it('lists every line with its unit price and quantity', () => {
    renderWithProviders(<OrderSummaryPanel preview={makeDeliveryPreview()} />);

    expect(screen.getByText('Olper’s Full Cream Milk')).toBeInTheDocument();
    expect(screen.getByText(/Rs\. 340 × 2/)).toBeInTheDocument();
    expect(screen.getByText('Rs. 680')).toBeInTheDocument();
  });

  it('announces the total in words a screen reader can speak', () => {
    renderWithProviders(<OrderSummaryPanel preview={makeDeliveryPreview()} />);

    // "Rs." is read as letters; the spoken label says "rupees".
    expect(screen.getByLabelText(/1,950 rupees/)).toBeInTheDocument();
  });

  it('shows a loading state rather than a stale or zero total', () => {
    renderWithProviders(<OrderSummaryPanel preview={null} isLoading />);

    expect(screen.getByLabelText('Calculating your total')).toBeInTheDocument();
    expect(screen.queryByText('Rs. 0')).not.toBeInTheDocument();
  });

  it('omits the travel estimate when the provider did not give one', () => {
    const preview = makeDeliveryPreview({
      delivery: { ...makeDeliveryPreview().delivery!, durationSeconds: null },
    });

    renderWithProviders(<OrderSummaryPanel preview={preview} />);

    expect(screen.queryByText(/Estimated travel time/)).not.toBeInTheDocument();
  });
});

describe('formatDistance', () => {
  it('uses metres below a kilometre', () => {
    expect(formatDistance(850)).toBe('850 m');
  });

  it('uses kilometres to one decimal above that', () => {
    expect(formatDistance(4300)).toBe('4.3 km');
    expect(formatDistance(12000)).toBe('12.0 km');
  });
});

describe('formatDuration', () => {
  it('rounds to whole minutes', () => {
    expect(formatDuration(900)).toBe('about 15 min');
  });

  it('never claims zero minutes for a real journey', () => {
    expect(formatDuration(20)).toBe('about 1 min');
  });

  it('breaks an hour or more into hours and minutes', () => {
    expect(formatDuration(3900)).toBe('about 1 hr 5 min');
  });
});

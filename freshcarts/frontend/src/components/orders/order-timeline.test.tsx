import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { OrderTimeline } from './order-timeline';
import type { TimelineStep } from '@/types/order';

function step(
  overrides: Partial<TimelineStep> & Pick<TimelineStep, 'status' | 'label'>,
): TimelineStep {
  return {
    isComplete: false,
    isCurrent: false,
    changedAt: null,
    note: null,
    ...overrides,
  };
}

/** A delivery order that has reached PREPARING, as the API would describe it. */
const preparingDelivery: TimelineStep[] = [
  step({
    status: 'PENDING',
    label: 'Order placed',
    isComplete: true,
    changedAt: '2026-02-01T10:00:00.000Z',
    note: 'Order placed and waiting for the store to confirm.',
  }),
  step({
    status: 'CONFIRMED',
    label: 'Confirmed',
    isComplete: true,
    changedAt: '2026-02-01T10:05:00.000Z',
    note: 'The store has confirmed your order.',
  }),
  step({
    status: 'PREPARING',
    label: 'Preparing',
    isCurrent: true,
    changedAt: '2026-02-01T10:12:00.000Z',
    note: 'Your order is being prepared.',
  }),
  step({ status: 'PACKED', label: 'Packed' }),
  step({ status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' }),
  step({ status: 'DELIVERED', label: 'Delivered' }),
];

describe('OrderTimeline', () => {
  it('renders the steps the server sent, in order', () => {
    render(<OrderTimeline steps={preparingDelivery} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(within(items[0]).getByText('Order placed')).toBeInTheDocument();
    expect(within(items[4]).getByText('Out for delivery')).toBeInTheDocument();
  });

  it('takes the active step from the data, never from a hardcoded index', () => {
    // §37: the frontend renders the server's decision. Move `isCurrent` and the
    // rendered "In progress" marker moves with it — nothing here counts steps.
    const shifted = preparingDelivery.map((entry) => ({
      ...entry,
      isComplete: entry.status === 'PENDING',
      isCurrent: entry.status === 'CONFIRMED',
    }));

    render(<OrderTimeline steps={shifted} />);

    const items = screen.getAllByRole('listitem');
    expect(within(items[1]).getByText('In progress')).toBeInTheDocument();
    expect(within(items[2]).getByText('Not yet')).toBeInTheDocument();
  });

  it('states each step’s state in words, not only by colour or shape', () => {
    render(<OrderTimeline steps={preparingDelivery} />);

    // §39 and §56: colour alone is not an accessible signal.
    expect(screen.getAllByText('Completed')).toHaveLength(2);
    expect(screen.getAllByText('In progress')).toHaveLength(1);
    expect(screen.getAllByText('Not yet')).toHaveLength(3);
  });

  it('shows when each reached step happened', () => {
    render(<OrderTimeline steps={preparingDelivery} />);

    // Rendered in the shopper's locale; the day and month are the stable part.
    expect(screen.getAllByText(/1 Feb/).length).toBeGreaterThan(0);
  });

  it('shows the note for steps that have happened, and not for those ahead', () => {
    render(<OrderTimeline steps={preparingDelivery} />);

    expect(screen.getByText('Your order is being prepared.')).toBeInTheDocument();
    expect(screen.queryByText(/on its way/i)).not.toBeInTheDocument();
  });

  it('renders the pickup journey when that is what the server sent', () => {
    const pickup: TimelineStep[] = [
      step({ status: 'PENDING', label: 'Order placed', isComplete: true }),
      step({ status: 'CONFIRMED', label: 'Confirmed', isComplete: true }),
      step({ status: 'PREPARING', label: 'Preparing', isComplete: true }),
      step({ status: 'PACKED', label: 'Packed', isComplete: true }),
      step({ status: 'READY_FOR_PICKUP', label: 'Ready for pickup', isCurrent: true }),
      step({ status: 'DELIVERED', label: 'Collected' }),
    ];

    render(<OrderTimeline steps={pickup} />);

    expect(screen.getByText('Ready for pickup')).toBeInTheDocument();
    expect(screen.getByText('Collected')).toBeInTheDocument();
    // The rule the component never has to know, because the server enforces it.
    expect(screen.queryByText('Out for delivery')).not.toBeInTheDocument();
  });

  it('shows a cancellation as the step the order rests on', () => {
    const cancelled: TimelineStep[] = [
      step({ status: 'PENDING', label: 'Order placed', isComplete: true }),
      step({ status: 'CONFIRMED', label: 'Confirmed' }),
      step({
        status: 'CANCELLED',
        label: 'Cancelled',
        isCurrent: true,
        changedAt: '2026-02-01T11:00:00.000Z',
        note: 'Cancelled by the customer.',
      }),
    ];

    render(<OrderTimeline steps={cancelled} />);

    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('Cancelled by the customer.')).toBeInTheDocument();
  });

  it('is an ordered list, so the sequence survives without the visuals', () => {
    render(<OrderTimeline steps={preparingDelivery} />);

    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});

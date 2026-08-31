import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, signIn, signOut } from '@/test/render';
import { useToastStore } from '@/store/toast.store';
import {
  CANCEL_ACTION,
  CONFIRM_ACTION,
  PACK_ACTION,
  REJECT_ACTION,
  makeStoreOrderDetail,
  testStoreManager,
} from '@/test/store-fixtures';
import { OrderActionBar } from './order-action-bar';

/** Captures the request the component makes, and controls when it resolves. */
function stubFetch() {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  let resolveNext: ((value: unknown) => void) | null = null;

  const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });

    return new Promise((resolve) => {
      resolveNext = (value) =>
        resolve(
          new Response(JSON.stringify(value), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
    });
  });

  vi.stubGlobal('fetch', fetchMock);

  return {
    calls,
    /** Completes the in-flight request. */
    settle: (value: unknown) => resolveNext?.(value),
  };
}

describe('OrderActionBar', () => {
  let http: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    signIn(testStoreManager);
    http = stubFetch();
  });

  afterEach(() => {
    signOut();
    vi.unstubAllGlobals();
  });

  it('renders only the actions the server offers', () => {
    renderWithProviders(<OrderActionBar order={makeStoreOrderDetail()} />);

    expect(screen.getByRole('button', { name: 'Confirm order' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject order' })).toBeInTheDocument();

    // The console never invents a transition. A pending order has no pack step,
    // so no such button can exist.
    expect(screen.queryByRole('button', { name: 'Mark packed' })).not.toBeInTheDocument();
  });

  it('never offers the wrong fulfilment lane', () => {
    // A packed DELIVERY order. The API omits READY_FOR_PICKUP entirely, so the
    // button cannot be drawn — this is the UI half of §15's hard rule.
    const order = makeStoreOrderDetail({
      status: 'PACKED',
      statusLabel: 'Packed',
      availableActions: [
        {
          status: 'OUT_FOR_DELIVERY',
          action: 'OUT_FOR_DELIVERY',
          label: 'Out for delivery',
          intent: 'PRIMARY',
          requiresReason: false,
        },
        CANCEL_ACTION,
      ],
    });

    renderWithProviders(<OrderActionBar order={order} />);

    expect(screen.getByRole('button', { name: 'Out for delivery' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ready for pickup/i })).not.toBeInTheDocument();
  });

  it('sends only the target status when confirming', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderActionBar order={makeStoreOrderDetail()} />);

    await user.click(screen.getByRole('button', { name: 'Confirm order' }));

    await waitFor(() => expect(http.calls.length).toBe(1));

    expect(http.calls[0].method).toBe('PATCH');
    expect(http.calls[0].url).toContain('/store-manager/orders/order-1/status');
    // No store id, no actor, no prices — the server derives all of them.
    expect(http.calls[0].body).toEqual({ status: 'CONFIRMED', reason: undefined });
  });

  it('waits for the server before showing the new state (§46)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderActionBar order={makeStoreOrderDetail()} />);

    const button = screen.getByRole('button', { name: 'Confirm order' });
    await user.click(button);

    // Mid-flight: the control reports itself busy and is not clickable again.
    // Nothing anywhere claims the order has moved.
    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'true'));
    expect(button).toBeDisabled();

    http.settle(makeStoreOrderDetail({ status: 'CONFIRMED', statusLabel: 'Confirmed' }));

    await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'));
  });

  it('does not send a rejection until a reason is chosen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderActionBar order={makeStoreOrderDetail()} />);

    await user.click(screen.getByRole('button', { name: 'Reject order' }));

    // A dialog, not an immediate write: §43 requires confirmation for a
    // destructive action.
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Reject order');
    expect(http.calls.length).toBe(0);
  });

  it('sends the preset reason and note on rejection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderActionBar order={makeStoreOrderDetail()} />);

    await user.click(screen.getByRole('button', { name: 'Reject order' }));
    await screen.findByRole('dialog');

    await user.selectOptions(screen.getByLabelText('Reason'), 'STORE_CLOSED');
    await user.type(screen.getByLabelText('Note (optional)'), 'Closing early today');

    // Two controls now share the name — the trigger behind the dialog and the
    // dialog's own submit. Scope the query to the dialog.
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reject order' }));

    await waitFor(() => expect(http.calls.length).toBeGreaterThan(0));

    const reject = http.calls.find((call) => call.url.includes('/reject'));
    expect(reject?.body).toEqual({ reason: 'STORE_CLOSED', note: 'Closing early today' });
  });

  it('requires a reason before a cancellation can be submitted', async () => {
    const user = userEvent.setup();
    const order = makeStoreOrderDetail({
      status: 'PREPARING',
      statusLabel: 'Preparing',
      availableActions: [PACK_ACTION, CANCEL_ACTION],
    });

    renderWithProviders(<OrderActionBar order={order} />);

    await user.click(screen.getByRole('button', { name: 'Cancel order' }));
    await screen.findByRole('dialog');

    const submit = within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Cancel order',
    });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Reason'), 'Fridge failure overnight');
    expect(submit).toBeEnabled();
  });

  it('says there is nothing to do on a finished order', () => {
    renderWithProviders(
      <OrderActionBar
        order={makeStoreOrderDetail({
          status: 'DELIVERED',
          statusLabel: 'Delivered',
          availableActions: [],
        })}
      />,
    );

    expect(screen.getByText(/nothing left to do/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('explains a stale transition in operational terms', async () => {
    const user = userEvent.setup();

    // A colleague already advanced the order, so the API refuses this one.
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              statusCode: 409,
              message: 'An order cannot move from CONFIRMED to CONFIRMED.',
              code: 'INVALID_STATUS_TRANSITION',
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    );

    renderWithProviders(<OrderActionBar order={makeStoreOrderDetail()} />);
    await user.click(screen.getByRole('button', { name: 'Confirm order' }));

    // Asserted against the toast store rather than the DOM: the toast viewport
    // lives in AppProviders, which this harness deliberately does not mount.
    await waitFor(() => {
      const messages = useToastStore.getState().toasts.map((toast) => toast.description ?? '');
      expect(messages.join(' ')).toMatch(/already been updated by someone else/i);
    });
  });

  it('keeps the primary action distinct from the destructive one', () => {
    renderWithProviders(<OrderActionBar order={makeStoreOrderDetail()} />);

    const confirm = screen.getByRole('button', { name: 'Confirm order' });
    const reject = screen.getByRole('button', { name: 'Reject order' });

    // §45: one prominent action. The destructive one is present but not styled
    // as the thing to press.
    expect(confirm.className).toContain('bg-primary');
    expect(reject.className).not.toContain('bg-primary');
  });

  it('is reachable by keyboard alone', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderActionBar order={makeStoreOrderDetail()} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Confirm order' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Reject order' })).toHaveFocus();
  });
});

describe('OrderActionBar — pickup lane', () => {
  beforeEach(() => {
    signIn(testStoreManager);
    stubFetch();
  });

  afterEach(() => {
    signOut();
    vi.unstubAllGlobals();
  });

  it('words the completion step as a pickup', () => {
    const order = makeStoreOrderDetail({
      fulfillmentMethod: 'PICKUP',
      status: 'READY_FOR_PICKUP',
      statusLabel: 'Ready for pickup',
      availableActions: [
        {
          status: 'DELIVERED',
          action: 'COMPLETE_PICKUP',
          label: 'Complete pickup',
          intent: 'PRIMARY',
          requiresReason: false,
        },
      ],
    });

    renderWithProviders(<OrderActionBar order={order} />);

    expect(screen.getByRole('button', { name: 'Complete pickup' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark delivered/i })).not.toBeInTheDocument();
  });
});

/** Guards the fixture set itself, so a wrong assumption fails here not there. */
describe('action fixtures', () => {
  it('models exactly one primary action', () => {
    const actions = [CONFIRM_ACTION, REJECT_ACTION];
    expect(actions.filter((action) => action.intent === 'PRIMARY')).toHaveLength(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminShell } from '@/app/(admin)/admin/admin-shell';
import { AdminCustomersScreen } from '@/app/(admin)/admin/customers/customers-screen';
import { AdminOrdersScreen } from '@/app/(admin)/admin/orders/orders-screen';
import { DashboardScreen } from '@/app/(store-manager)/store-manager/dashboard-screen';
import { OrderDetailScreen } from '@/app/(store-manager)/store-manager/orders/[id]/order-detail-screen';
import { StoreShell } from '@/app/(store-manager)/store-manager/store-shell';
import { ProductForm } from '@/components/admin/product-form';
import { OrderActionBar } from '@/components/store-manager/order-action-bar';
import { OcrItemCard } from '@/components/scan/ocr-item-card';
import { OrderCard } from '@/components/orders/order-card';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { describeError } from '@/lib/api/error-copy';
import { ApiError } from '@/lib/api/errors';
import { LocaleProvider, translate } from '@/i18n';
import type { SelectionLine } from '@/features/scan/use-scan-selection';
import {
  makeAdminOrderSummary,
  makeCustomer,
  testAdmin,
} from '@/test/admin-fixtures';
import { makeMatchedItem, makeOrderSummary } from '@/test/fixtures';
import { renderWithProviders, signIn } from '@/test/render';
import {
  CANCEL_ACTION,
  CONFIRM_ACTION,
  makeStoreDashboard,
  makeStoreOrderDetail,
  makeStoreOrderSummary,
  paginate,
  testStoreManager,
} from '@/test/store-fixtures';

/**
 * THE SCREENS IN URDU
 *
 * The same components the English tests drive, rendered with `locale: 'ur'`:
 * the customer's orders, the grocery-list scanner, the store console and the
 * back office. They cover the three promises the feature makes:
 *
 *   1. Our words are Urdu — and none of the English UI text is left over.
 *   2. Their data is untouched — names, products, stores stay as entered.
 *   3. Things that must read left-to-right (phones, order numbers, prices, SKUs)
 *      are isolated so the surrounding right-to-left text cannot scramble them.
 *
 * The Store Manager and Admin screens cannot be checked by eye in this project
 * (see the milestone's constraints), so these tests are the verification there.
 */

const ARABIC_SCRIPT = /[؀-ۿ]/;

const searchParams = { current: new URLSearchParams() };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin',
  useSearchParams: () => searchParams.current,
}));

function stubRoutes(routes: Array<{ match: string; body: unknown; status?: number }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = String(input);
      const route = routes.find((candidate) => url.includes(candidate.match));

      return Promise.resolve(
        new Response(JSON.stringify(route?.body ?? {}), {
          status: route?.status ?? (route ? 200 : 404),
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );
}

/** Every `<bdi dir="ltr">` on the page — the isolates that keep figures in order. */
const isolates = (root: HTMLElement = document.body) =>
  [...root.querySelectorAll('bdi[dir="ltr"]')].map((node) => node.textContent);

beforeEach(() => {
  searchParams.current = new URLSearchParams();
});

afterEach(() => {
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
});

describe('customer screens', () => {
  it('shows an order in Urdu and keeps the order number and total left to right', () => {
    render(
      <LocaleProvider initialLocale="ur">
        <OrderCard order={makeOrderSummary()} />
      </LocaleProvider>,
    );

    // Our words: the status, the item count and the delivery method.
    expect(screen.getByText(translate('ur', 'orders.status.PENDING'))).toBeInTheDocument();
    expect(screen.getByText(translate('ur', 'common.itemCount', { count: 3 }))).toBeInTheDocument();
    expect(screen.queryByText('Order placed')).not.toBeInTheDocument();
    expect(screen.queryByText('3 items')).not.toBeInTheDocument();

    // Their data: the store's name is exactly what the store entered.
    expect(screen.getByText('FreshCarts Gulberg')).toBeInTheDocument();

    // Figures that must not be reordered by the right-to-left text around them.
    expect(isolates()).toEqual(expect.arrayContaining(['FC-2026-0001482']));
    expect(isolates().some((text) => /Rs\.\s?1,950/.test(text ?? ''))).toBe(true);
  });

  it('finishes a pickup as "collected", not "delivered", in Urdu as in English', () => {
    render(
      <LocaleProvider initialLocale="ur">
        <OrderStatusBadge status="DELIVERED" label="Collected" fulfillmentMethod="PICKUP" />
      </LocaleProvider>,
    );

    expect(screen.getByText(translate('ur', 'orders.status.COLLECTED'))).toBeInTheDocument();
    expect(screen.queryByText('Collected')).not.toBeInTheDocument();
  });

  it('turns an API error code into Urdu copy instead of the server sentence', () => {
    const error = new ApiError(409, 'Your cart is empty', [], 'CART_EMPTY');

    expect(describeError(error, (key, vars) => translate('ur', key, vars), 'ur')).toBe(
      translate('ur', 'errors.CART_EMPTY'),
    );
    // English keeps the server's own sentence, as it always did.
    expect(describeError(error, (key, vars) => translate('en', key, vars), 'en')).toBe(
      'Your cart is empty',
    );
  });
});

describe('the grocery-list scanner', () => {
  function line(overrides: Partial<SelectionLine> = {}): SelectionLine {
    const item = makeMatchedItem();

    return {
      lineId: item.lineId,
      item,
      chosen: item.match.product,
      quantity: item.source.quantity,
      removed: false,
      addedToCart: false,
      cappedByStock: false,
      ...overrides,
    };
  }

  it('reads a scanned line in Urdu while the shopper’s own words stay exactly as written', () => {
    render(
      <LocaleProvider initialLocale="ur">
        <ul>
          <OcrItemCard
            line={line()}
            onChangeProduct={vi.fn()}
            onQuantityChange={vi.fn()}
            onRemove={vi.fn()}
            onRestore={vi.fn()}
          />
        </ul>
      </LocaleProvider>,
    );

    expect(screen.getByText(translate('ur', 'ocr.card.wrote'))).toBeInTheDocument();
    expect(screen.getByText(translate('ur', 'ocr.card.found'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: translate('ur', 'ocr.card.changeProduct') })).toBeInTheDocument();
    expect(screen.queryByText('You wrote')).not.toBeInTheDocument();

    // What they wrote is not ours to translate.
    expect(screen.getByText('2 doodh')).toBeInTheDocument();
  });

  it('mirrors nothing it should not: the undo arrow flips, the product picture does not', () => {
    const { container } = render(
      <LocaleProvider initialLocale="ur">
        <ul>
          <OcrItemCard
            line={line({ removed: true })}
            onChangeProduct={vi.fn()}
            onQuantityChange={vi.fn()}
            onRemove={vi.fn()}
            onRestore={vi.fn()}
          />
        </ul>
      </LocaleProvider>,
    );

    const undo = screen.getByRole('button', { name: translate('ur', 'ocr.card.undo') });
    expect(undo.querySelector('svg')).toHaveClass('rtl:-scale-x-100');
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('the store console', () => {
  beforeEach(() => signIn(testStoreManager));

  it('shows the dashboard in Urdu', async () => {
    stubRoutes([
      { match: '/store-manager/dashboard', body: makeStoreDashboard() },
      { match: '/store-manager/orders', body: paginate([makeStoreOrderSummary()]) },
    ]);

    renderWithProviders(<DashboardScreen />, { locale: 'ur' });

    expect(
      await screen.findByText(translate('ur', 'store.dashboard.attention', { count: 14 })),
    ).toBeInTheDocument();
    expect(screen.getByText(translate('ur', 'store.dashboard.inventoryAlerts'))).toBeInTheDocument();
    expect(screen.queryByText('Inventory alerts')).not.toBeInTheDocument();

    // The store's name is the store's own.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('FreshCarts Gulberg');
  });

  it('names the sections of the console in Urdu and offers a way to change language', async () => {
    stubRoutes([{ match: '/store-manager/dashboard', body: makeStoreDashboard() }]);

    renderWithProviders(
      <StoreShell>
        <p>x</p>
      </StoreShell>,
      { locale: 'ur' },
    );

    const nav = screen.getByRole('navigation', { name: translate('ur', 'store.shell.navLabel') });

    for (const key of [
      'store.shell.dashboard',
      'store.shell.orders',
      'store.shell.inventory',
      'store.shell.products',
    ] as const) {
      expect(within(nav).getByRole('link', { name: translate('ur', key) })).toBeInTheDocument();
    }

    // The switch sits in the same sidebar, so staff can change language mid-shift.
    expect(
      within(nav).getByRole('group', { name: translate('ur', 'language.label') }),
    ).toBeInTheDocument();
  });

  it('labels the order actions from their stable key, not from the server’s English', () => {
    // The API says "Confirm order" in English and could reword it tomorrow. In
    // Urdu the button is built from `action: "CONFIRM"`, so it can never go
    // missing or read oddly because the server's wording changed.
    const order = makeStoreOrderDetail({
      availableActions: [{ ...CONFIRM_ACTION, label: 'Whatever the server says now' }, CANCEL_ACTION],
    });
    stubRoutes([]);

    renderWithProviders(<OrderActionBar order={order} />, { locale: 'ur' });

    expect(
      screen.getByRole('button', { name: translate('ur', 'store.action.CONFIRM') }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Whatever the server says now')).not.toBeInTheDocument();
  });

  it('opens the cancel dialog in Urdu and keeps the order number readable inside it', async () => {
    const user = userEvent.setup();
    stubRoutes([]);

    renderWithProviders(
      <OrderActionBar
        order={makeStoreOrderDetail({ availableActions: [CONFIRM_ACTION, CANCEL_ACTION] })}
      />,
      { locale: 'ur' },
    );

    await user.click(screen.getByRole('button', { name: translate('ur', 'store.action.CANCEL') }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(translate('ur', 'store.actionBar.reason'))).toBeInTheDocument();
    expect(dialog.textContent).toContain('⁦FC-2026-0000001⁩');
  });

  it('shows an order’s detail in Urdu with the customer’s phone isolated left to right', async () => {
    stubRoutes([
      { match: '/store-manager/orders/', body: makeStoreOrderDetail() },
    ]);

    renderWithProviders(<OrderDetailScreen id="order-1" />, { locale: 'ur' });

    expect(await screen.findByText(translate('ur', 'store.picking.items'))).toBeInTheDocument();
    expect(isolates()).toEqual(expect.arrayContaining(['+923001234569', 'FC-2026-0000001']));

    // Product names and the customer's name are data and stay as they are.
    expect(screen.getByText('Olper’s Full Cream Milk')).toBeInTheDocument();
    expect(screen.getByText('Ayesha Khan')).toBeInTheDocument();
    expect(screen.queryByText('Next step')).not.toBeInTheDocument();
  });
});

describe('the back office', () => {
  beforeEach(() => signIn(testAdmin));

  it('shows the navigation in Urdu and offers the language switch', () => {
    renderWithProviders(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
      { locale: 'ur' },
    );

    const nav = screen.getByRole('navigation', { name: translate('ur', 'admin.nav.backOffice') });

    expect(within(nav).getByRole('link', { name: translate('ur', 'admin.nav.orders') })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Orders' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: translate('ur', 'language.label') })).toBeInTheDocument();
  });

  it('changes language from the back office without losing the page', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AdminShell>
        <input aria-label="draft" />
      </AdminShell>,
      { locale: 'ur' },
    );

    await user.type(screen.getByLabelText('draft'), 'half typed');
    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(screen.getByLabelText('draft')).toHaveValue('half typed');
    expect(
      within(screen.getByRole('navigation', { name: /back office/i })).getByRole('link', {
        name: 'Orders',
      }),
    ).toBeInTheDocument();
  });

  it('lists orders in Urdu with right-aligned figures, mirrored by direction rather than "right"', async () => {
    stubRoutes([
      { match: '/admin/orders', body: paginate([makeAdminOrderSummary()]) },
      { match: '/admin/stores', body: [] },
    ]);

    renderWithProviders(<AdminOrdersScreen />, { locale: 'ur' });

    const table = await screen.findByRole('table');

    expect(
      within(table).getByRole('columnheader', { name: translate('ur', 'admin.orders.colStore') }),
    ).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Store' })).not.toBeInTheDocument();

    // "Start" and "end", never "left" and "right": a physical class would stay
    // on the wrong side after the page flips.
    expect(table.innerHTML).not.toMatch(/text-(left|right)\b/);
    expect(isolates(table)).toEqual(expect.arrayContaining(['FC-2026-0000001', '+923001234569']));
  });

  it('lists customers in Urdu, with an email kept readable and a name left as entered', async () => {
    stubRoutes([
      {
        match: '/admin/customers',
        body: paginate([makeCustomer({ email: 'ayesha@example.com', fullName: 'عائشہ خان' })]),
      },
    ]);

    renderWithProviders(<AdminCustomersScreen />, { locale: 'ur' });

    await screen.findByRole('table');

    expect(screen.getByText('عائشہ خان')).toBeInTheDocument();
    expect(isolates()).toContain('ayesha@example.com');
    expect(screen.getByRole('searchbox', { name: translate('ur', 'admin.customers.searchLabel') })).toBeInTheDocument();
  });

  it('reports a form mistake in Urdu', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ProductForm categories={[]} isSubmitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />,
      { locale: 'ur' },
    );

    await user.click(
      screen.getByRole('button', { name: translate('ur', 'admin.productForm.create') }),
    );

    expect(
      await screen.findByText(translate('ur', 'validation.catalog.productName')),
    ).toBeInTheDocument();
    expect(screen.queryByText('Give the product a name')).not.toBeInTheDocument();
  });
});

describe('English is untouched', () => {
  it('renders exactly the English wording when no language was chosen', () => {
    render(<OrderCard order={makeOrderSummary()} />);

    expect(screen.getByText('Order placed')).toBeInTheDocument();
    expect(screen.getByText('3 items')).toBeInTheDocument();
    // Nothing is isolated in English: there is nothing to protect against.
    expect(document.body.textContent).not.toMatch(/[⁦⁩]/);
    expect(document.body.textContent).not.toMatch(ARABIC_SCRIPT);
  });
});

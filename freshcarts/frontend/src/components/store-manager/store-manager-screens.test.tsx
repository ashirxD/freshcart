import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, signIn, signOut, testCustomer } from '@/test/render';
import {
  makeInventoryRow,
  makeStoreDashboard,
  makeStoreOrderSummary,
  paginate,
  testStoreManager,
} from '@/test/store-fixtures';
import { DashboardScreen } from '@/app/(store-manager)/store-manager/dashboard-screen';
import { InventoryScreen } from '@/app/(store-manager)/store-manager/inventory/inventory-screen';
import { StoreShell } from '@/app/(store-manager)/store-manager/store-shell';

/**
 * Next's navigation hooks are module-level in these screens, so they are stubbed
 * rather than wrapped in a router: the tests are about what the screens render
 * and request, not about routing.
 */
const searchParams = { current: new URLSearchParams() };
const replaced: string[] = [];

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: (url: string) => replaced.push(url),
    push: (url: string) => replaced.push(url),
  }),
  usePathname: () => '/store-manager/inventory',
  useSearchParams: () => searchParams.current,
}));

/** Routes stubbed fetch by URL, so a screen's several queries each get an answer. */
function stubRoutes(routes: Array<{ match: string; body: unknown; status?: number }>) {
  const calls: string[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);

      const route = routes.find((candidate) => url.includes(candidate.match));

      return Promise.resolve(
        new Response(JSON.stringify(route?.body ?? {}), {
          status: route?.status ?? (route ? 200 : 404),
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );

  return { calls };
}

beforeEach(() => {
  searchParams.current = new URLSearchParams();
  replaced.length = 0;
  signIn(testStoreManager);
});

afterEach(() => {
  signOut();
  vi.unstubAllGlobals();
});

describe('StoreShell', () => {
  it('shows the console to store staff', async () => {
    stubRoutes([{ match: '/store-manager/dashboard', body: makeStoreDashboard() }]);

    renderWithProviders(
      <StoreShell>
        <p>Console content</p>
      </StoreShell>,
    );

    expect(screen.getByText('Console content')).toBeInTheDocument();
    // The store badge is rendered twice — once in the mobile header, once in the
    // desktop sidebar — and CSS decides which is visible. jsdom applies no CSS,
    // so both are in the tree here.
    expect((await screen.findAllByText('FreshCarts Gulberg')).length).toBeGreaterThan(0);
  });

  it('refuses a customer, without rendering the console', () => {
    signIn(testCustomer);
    stubRoutes([]);

    renderWithProviders(
      <StoreShell>
        <p>Console content</p>
      </StoreShell>,
    );

    expect(screen.getByText('Store staff only')).toBeInTheDocument();
    expect(screen.queryByText('Console content')).not.toBeInTheDocument();
  });

  it('offers the four operations sections and nothing from the customer app', async () => {
    stubRoutes([{ match: '/store-manager/dashboard', body: makeStoreDashboard() }]);

    renderWithProviders(
      <StoreShell>
        <p>x</p>
      </StoreShell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Store operations' });

    for (const label of ['Dashboard', 'Orders', 'Inventory', 'Products']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }

    // §7: no shopping navigation as the primary navigation.
    expect(within(nav).queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /^search$/i })).not.toBeInTheDocument();
  });

  it('reports whether the store is open', async () => {
    stubRoutes([
      {
        match: '/store-manager/dashboard',
        body: makeStoreDashboard({
          store: { ...makeStoreDashboard().store, isOpen: false },
        }),
      },
    ]);

    renderWithProviders(
      <StoreShell>
        <p>x</p>
      </StoreShell>,
    );

    expect((await screen.findAllByText('Closed')).length).toBeGreaterThan(0);
  });

  it('gives the mobile drawer trigger an accessible name', async () => {
    stubRoutes([{ match: '/store-manager/dashboard', body: makeStoreDashboard() }]);

    renderWithProviders(
      <StoreShell>
        <p>x</p>
      </StoreShell>,
    );

    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument();
  });
});

describe('DashboardScreen', () => {
  it('shows a skeleton before the numbers arrive', () => {
    stubRoutes([{ match: '/store-manager/dashboard', body: makeStoreDashboard() }]);

    renderWithProviders(<DashboardScreen />);

    expect(screen.getByLabelText('Loading the dashboard')).toBeInTheDocument();
  });

  it('leads with what needs action (§5)', async () => {
    stubRoutes([
      { match: '/store-manager/dashboard', body: makeStoreDashboard() },
      { match: '/store-manager/orders', body: paginate([makeStoreOrderSummary()]) },
    ]);

    renderWithProviders(<DashboardScreen />);

    expect(await screen.findByText('14 orders need your attention.')).toBeInTheDocument();

    // The headings appear in priority order: orders, then inventory.
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.indexOf('Orders needing attention')).toBeLessThan(
      headings.indexOf('Inventory alerts'),
    );
  });

  it('links every count to the list it came from (§59)', async () => {
    stubRoutes([
      { match: '/store-manager/dashboard', body: makeStoreDashboard() },
      { match: '/store-manager/orders', body: paginate([]) },
    ]);

    renderWithProviders(<DashboardScreen />);

    await screen.findByText('Inventory alerts');

    const lowStock = screen.getByRole('link', { name: /Low stock/ });
    expect(lowStock).toHaveAttribute('href', '/store-manager/inventory?status=LOW_STOCK');

    const pending = screen.getByRole('link', { name: /Pending/ });
    expect(pending).toHaveAttribute('href', '/store-manager/orders?status=PENDING');
  });

  it('says so plainly when nothing needs attention (§60)', async () => {
    stubRoutes([
      {
        match: '/store-manager/dashboard',
        body: makeStoreDashboard({
          orders: { ...makeStoreDashboard().orders, needsAction: 0 },
          inventory: { inStock: 53, lowStock: 0, outOfStock: 0 },
        }),
      },
      { match: '/store-manager/orders', body: paginate([]) },
    ]);

    renderWithProviders(<DashboardScreen />);

    expect(await screen.findByText('Nothing is waiting on you right now.')).toBeInTheDocument();
    expect(screen.getByText('Everything looks well stocked.')).toBeInTheDocument();
    expect(screen.getByText('No orders need your attention')).toBeInTheDocument();
  });

  it('shows a friendly error and a retry when the dashboard fails', async () => {
    stubRoutes([
      { match: '/store-manager/dashboard', body: { message: 'boom' }, status: 500 },
    ]);

    renderWithProviders(<DashboardScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not load your dashboard|something went wrong/i,
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('surfaces replacements only when some are waiting', async () => {
    stubRoutes([
      {
        match: '/store-manager/dashboard',
        body: makeStoreDashboard({ substitutions: { awaitingCustomer: 2 } }),
      },
      { match: '/store-manager/orders', body: paginate([]) },
    ]);

    renderWithProviders(<DashboardScreen />);

    expect(await screen.findByText(/Replacements waiting on customers/)).toBeInTheDocument();
  });
});

describe('InventoryScreen', () => {
  it('lists stock with its derived status and threshold (§30)', async () => {
    stubRoutes([
      { match: '/store-manager/inventory', body: paginate([makeInventoryRow()]) },
    ]);

    renderWithProviders(<InventoryScreen />);

    expect(await screen.findByText('Kashmiri Apples')).toBeInTheDocument();
    expect(screen.getByText('FC-FRT-003')).toBeInTheDocument();
    expect(screen.getByText(/Running low · 3 on hand · warns at 5/)).toBeInTheDocument();
  });

  it('offers the four stock filters as a single-choice group', async () => {
    stubRoutes([{ match: '/store-manager/inventory', body: paginate([]) }]);

    renderWithProviders(<InventoryScreen />);

    const group = screen.getByRole('radiogroup', { name: 'Stock status' });
    for (const label of ['All', 'Low stock', 'Out of stock', 'In stock']) {
      expect(within(group).getByRole('radio', { name: label })).toBeInTheDocument();
    }
  });

  it('reads the active filter from the URL, so a dashboard link lands correctly', async () => {
    searchParams.current = new URLSearchParams('status=LOW_STOCK');
    const { calls } = stubRoutes([
      { match: '/store-manager/inventory', body: paginate([makeInventoryRow()]) },
    ]);

    renderWithProviders(<InventoryScreen />);

    await screen.findByText('Kashmiri Apples');

    expect(calls.some((url) => url.includes('status=LOW_STOCK'))).toBe(true);
    expect(
      within(screen.getByRole('radiogroup', { name: 'Stock status' })).getByRole('radio', {
        name: 'Low stock',
      }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('sends a relative adjustment for the quick buttons', async () => {
    const user = userEvent.setup();
    const { calls } = stubRoutes([
      { match: '/store-manager/inventory', body: paginate([makeInventoryRow()]) },
    ]);

    renderWithProviders(<InventoryScreen />);
    await screen.findByText('Kashmiri Apples');

    await user.click(screen.getByRole('button', { name: 'Add ten Kashmiri Apples' }));

    await waitFor(() =>
      expect(calls.some((url) => url.includes('/store-manager/inventory/p1'))).toBe(true),
    );
  });

  it('confirms an absolute stock set before writing (§43)', async () => {
    const user = userEvent.setup();
    stubRoutes([{ match: '/store-manager/inventory', body: paginate([makeInventoryRow()]) }]);

    renderWithProviders(<InventoryScreen />);
    await screen.findByText('Kashmiri Apples');

    await user.click(screen.getByRole('button', { name: 'Set stock' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Set stock');
    // The reason is part of the audit row, so it is asked for here.
    expect(within(dialog).getByLabelText('Reason')).toBeInTheDocument();
  });

  it('says something useful when a filter matches nothing (§60)', async () => {
    searchParams.current = new URLSearchParams('status=LOW_STOCK');
    stubRoutes([{ match: '/store-manager/inventory', body: paginate([]) }]);

    renderWithProviders(<InventoryScreen />);

    expect(await screen.findByText('Everything looks well stocked')).toBeInTheDocument();
  });

  it('names the sold-out empty state differently', async () => {
    searchParams.current = new URLSearchParams('status=OUT_OF_STOCK');
    stubRoutes([{ match: '/store-manager/inventory', body: paginate([]) }]);

    renderWithProviders(<InventoryScreen />);

    expect(await screen.findByText('Nothing is out of stock')).toBeInTheDocument();
  });

  it('marks a product that is off sale', async () => {
    stubRoutes([
      {
        match: '/store-manager/inventory',
        body: paginate([makeInventoryRow({ isProductActive: false })]),
      },
    ]);

    renderWithProviders(<InventoryScreen />);

    expect(await screen.findByText('Off sale')).toBeInTheDocument();
  });
});

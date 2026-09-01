import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, signIn, signOut, testCustomer } from '@/test/render';
import { paginate, testStoreManager } from '@/test/store-fixtures';
import {
  makeAdminDashboard,
  makeAdminOrderSummary,
  makeAdminStore,
  makeAuditEntry,
  makeCustomer,
  makeCustomerDetail,
  makePlatformSettings,
  makeRuleSet,
  makeStoreManagerAccount,
  testAdmin,
} from '@/test/admin-fixtures';
import { AdminShell } from '@/app/(admin)/admin/admin-shell';
import { AdminDashboardScreen } from '@/app/(admin)/admin/dashboard-screen';
import { AdminCustomersScreen } from '@/app/(admin)/admin/customers/customers-screen';
import { AdminCustomerDetailScreen } from '@/app/(admin)/admin/customers/[id]/customer-detail-screen';
import { AdminOrdersScreen } from '@/app/(admin)/admin/orders/orders-screen';
import { AdminStoreManagersScreen } from '@/app/(admin)/admin/store-managers/store-managers-screen';
import { AdminStoresScreen } from '@/app/(admin)/admin/stores/stores-screen';
import { AdminDeliveryPricingScreen } from '@/app/(admin)/admin/delivery-pricing/delivery-pricing-screen';
import { AdminSettingsScreen } from '@/app/(admin)/admin/settings/settings-screen';

const searchParams = { current: new URLSearchParams() };
const pushed: string[] = [];

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: (url: string) => pushed.push(url),
    push: (url: string) => pushed.push(url),
  }),
  usePathname: () => '/admin',
  useSearchParams: () => searchParams.current,
}));

/** Routes stubbed fetch by URL, so a screen's several queries each get an answer. */
function stubRoutes(routes: Array<{ match: string; body: unknown; status?: number }>) {
  const requests: Array<{ url: string; method: string; body: unknown }> = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({
        url,
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });

      const route = routes.find((candidate) => url.includes(candidate.match));

      return Promise.resolve(
        new Response(JSON.stringify(route?.body ?? {}), {
          status: route?.status ?? (route ? 200 : 404),
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );

  return { requests };
}

beforeEach(() => {
  searchParams.current = new URLSearchParams();
  pushed.length = 0;
  signIn(testAdmin);
});

// No teardown here on purpose. vitest.setup.ts already unmounts, clears the
// session and drops the stubs, in that order — and the order is the point:
// resetting the session before unmounting makes still-mounted components react
// outside React's act window, which is where "not wrapped in act" comes from.

/**
 * THE ROLE GATE
 *
 * A usability measure, not a security boundary — but it must still hold, or a
 * customer lands on a screen of controls that would every one of them fail.
 */
describe('AdminShell', () => {
  it('shows the back office to an admin', () => {
    renderWithProviders(
      <AdminShell>
        <p>Back office content</p>
      </AdminShell>,
    );

    expect(screen.getByText('Back office content')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /back office/i })).toBeInTheDocument();
  });

  it('refuses a customer', () => {
    signIn(testCustomer);

    renderWithProviders(
      <AdminShell>
        <p>Back office content</p>
      </AdminShell>,
    );

    expect(screen.queryByText('Back office content')).not.toBeInTheDocument();
    expect(screen.getByText(/admin access only/i)).toBeInTheDocument();
  });

  it('refuses a store manager', () => {
    // Elevated over a customer, but not an admin: staff have their own console.
    signIn(testStoreManager);

    renderWithProviders(
      <AdminShell>
        <p>Back office content</p>
      </AdminShell>,
    );

    expect(screen.queryByText('Back office content')).not.toBeInTheDocument();
  });

  it('sends a signed-out visitor to sign in, returning them here afterwards', async () => {
    signOut();

    renderWithProviders(
      <AdminShell>
        <p>Back office content</p>
      </AdminShell>,
    );

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(pushed[0]).toContain('/login?next=');
  });

  it('links only to screens that exist', () => {
    renderWithProviders(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );

    const nav = screen.getByRole('navigation', { name: /back office/i });
    const hrefs = within(nav)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    // Section 6: no navigation into unfinished pages.
    expect(hrefs).toEqual([
      '/admin',
      '/admin/orders',
      '/admin/products',
      '/admin/categories',
      '/admin/inventory',
      '/admin/customers',
      '/admin/store-managers',
      '/admin/stores',
      '/admin/delivery-pricing',
      '/admin/settings',
    ]);
  });
});

describe('AdminDashboardScreen', () => {
  it('renders every tile from a single request', async () => {
    const { requests } = stubRoutes([{ match: '/admin/dashboard', body: makeAdminDashboard() }]);

    renderWithProviders(<AdminDashboardScreen />);

    await screen.findByText('Orders today');

    // Section 5: one aggregated endpoint, not a request per tile.
    expect(requests.filter((request) => request.url.includes('/admin/'))).toHaveLength(1);

    expect(screen.getByText('Rs. 5,600')).toBeInTheDocument();
    expect(screen.getByText('Products on sale')).toBeInTheDocument();
    expect(screen.getByText('Store managers')).toBeInTheDocument();
  });

  it('warns prominently when ordering is paused platform-wide', async () => {
    stubRoutes([
      {
        match: '/admin/dashboard',
        body: makeAdminDashboard({
          platform: { orderingEnabled: false, maxDeliveryDistanceMeters: 12_000 },
        }),
      },
    ]);

    renderWithProviders(<AdminDashboardScreen />);

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(/ordering is paused/i);
  });

  it('offers a way through to the list behind each number', async () => {
    stubRoutes([{ match: '/admin/dashboard', body: makeAdminDashboard() }]);

    renderWithProviders(<AdminDashboardScreen />);

    // A count nobody can act on is decoration.
    const lowStock = await screen.findByRole('link', { name: /running low/i });
    expect(lowStock).toHaveAttribute('href', '/admin/inventory?status=LOW_STOCK');
  });

  it('recovers from a failure instead of showing a blank screen', async () => {
    stubRoutes([{ match: '/admin/dashboard', body: { message: 'boom' }, status: 500 }]);

    renderWithProviders(<AdminDashboardScreen />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

describe('AdminOrdersScreen', () => {
  it('shows which store each order belongs to', async () => {
    stubRoutes([
      { match: '/admin/orders', body: paginate([makeAdminOrderSummary()]) },
      { match: '/stores', body: [makeAdminStore()] },
    ]);

    renderWithProviders(<AdminOrdersScreen />);

    await screen.findByRole('table');
    expect(screen.getByRole('columnheader', { name: 'Store' })).toBeInTheDocument();
    expect(screen.getAllByText('FreshCarts Gulberg').length).toBeGreaterThan(0);
  });

  it('applies a status filter from the URL, so dashboard links land filtered', async () => {
    searchParams.current = new URLSearchParams('status=PENDING');

    const { requests } = stubRoutes([
      { match: '/admin/orders', body: paginate([makeAdminOrderSummary()]) },
      { match: '/stores', body: [makeAdminStore()] },
    ]);

    renderWithProviders(<AdminOrdersScreen />);

    await waitFor(() =>
      expect(requests.some((request) => request.url.includes('status=PENDING'))).toBe(true),
    );
  });

  it('filters server-side rather than in the browser', async () => {
    const { requests } = stubRoutes([
      { match: '/admin/orders', body: paginate([makeAdminOrderSummary()]) },
      { match: '/stores', body: [makeAdminStore()] },
    ]);

    renderWithProviders(<AdminOrdersScreen />);
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Needs action' }));

    // The list is paginated and unbounded, so a filter must reach the server.
    await waitFor(() =>
      expect(requests.some((request) => request.url.includes('needsAction=true'))).toBe(true),
    );
  });

  it('uses shopper wording for the fulfilment method', async () => {
    stubRoutes([
      {
        match: '/admin/orders',
        body: paginate([makeAdminOrderSummary({ fulfillmentMethod: 'DELIVERY' })]),
      },
      { match: '/stores', body: [makeAdminStore()] },
    ]);

    renderWithProviders(<AdminOrdersScreen />);

    const table = await screen.findByRole('table');
    // Section 46: the enum stays internal.
    expect(within(table).queryByText('DELIVERY')).not.toBeInTheDocument();
    expect(within(table).getByText('Delivery')).toBeInTheDocument();
  });

  it('offers a useful empty state rather than a blank table', async () => {
    stubRoutes([
      { match: '/admin/orders', body: paginate([]) },
      { match: '/stores', body: [makeAdminStore()] },
    ]);

    renderWithProviders(<AdminOrdersScreen />);

    expect(await screen.findByText(/no orders match these filters/i)).toBeInTheDocument();
  });
});

describe('AdminCustomersScreen', () => {
  it('never renders a credential field', async () => {
    stubRoutes([{ match: '/admin/customers', body: paginate([makeCustomer()]) }]);

    const { container } = renderWithProviders(<AdminCustomersScreen />);

    await screen.findByRole('table');

    // The API does not send these; this asserts the screen has not grown a
    // column for one either (section 7, section 63).
    expect(container.textContent).not.toMatch(/password/i);
    expect(container.textContent).not.toMatch(/token/i);
  });

  it('states account status in words, not colour alone', async () => {
    stubRoutes([
      {
        match: '/admin/customers',
        body: paginate([makeCustomer({ isActive: false })]),
      },
    ]);

    renderWithProviders(<AdminCustomersScreen />);

    expect(await screen.findByText('Deactivated')).toBeInTheDocument();
  });

  it('searches on the server', async () => {
    const { requests } = stubRoutes([
      { match: '/admin/customers', body: paginate([makeCustomer()]) },
    ]);

    renderWithProviders(<AdminCustomersScreen />);
    await screen.findByRole('table');

    await userEvent.type(screen.getByRole('searchbox', { name: /search customers/i }), 'Ayesha');

    await waitFor(() =>
      expect(requests.some((request) => request.url.includes('search=Ayesha'))).toBe(true),
    );
  });
});

describe('AdminCustomerDetailScreen', () => {
  it('shows trading history and offers deactivation', async () => {
    stubRoutes([{ match: '/admin/customers/', body: makeCustomerDetail() }]);

    renderWithProviders(<AdminCustomerDetailScreen id="64b000000000000000000010" />);

    await screen.findByText('Ayesha Khan');
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Rs. 18,400')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /deactivate account/i })).toBeInTheDocument();
  });

  it('offers no way to act as the customer', async () => {
    // Section 8 rules out impersonation for this milestone, and there is no
    // API route for it — this keeps a button from appearing before there is.
    stubRoutes([{ match: '/admin/customers/', body: makeCustomerDetail() }]);

    renderWithProviders(<AdminCustomerDetailScreen id="64b000000000000000000010" />);

    await screen.findByText('Ayesha Khan');
    expect(
      screen.queryByRole('button', { name: /sign in as|impersonate/i }),
    ).not.toBeInTheDocument();
  });

  it('answers a missing customer with a route back', async () => {
    stubRoutes([{ match: '/admin/customers/', body: { message: 'Not found' }, status: 404 }]);

    renderWithProviders(<AdminCustomerDetailScreen id="64b000000000000000000099" />);

    expect(await screen.findByText(/customer not found/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to customers/i })).toBeInTheDocument();
  });
});

describe('AdminStoreManagersScreen', () => {
  it('flags a manager with no store, who cannot open any store screen', async () => {
    stubRoutes([
      {
        match: '/admin/store-managers',
        body: paginate([makeStoreManagerAccount({ store: null })]),
      },
      { match: '/stores', body: [makeAdminStore()] },
    ]);

    renderWithProviders(<AdminStoreManagersScreen />);

    expect(await screen.findByText(/no store assigned/i)).toBeInTheDocument();
  });

  it('requires a store when creating a manager', async () => {
    const { requests } = stubRoutes([
      { match: '/admin/store-managers', body: paginate([makeStoreManagerAccount()]) },
      { match: '/stores', body: [makeAdminStore()] },
    ]);

    renderWithProviders(<AdminStoreManagersScreen />);
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: /add manager/i }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/full name/i), 'Bilal Ahmed');
    await userEvent.type(within(dialog).getByLabelText(/phone number/i), '03001234570');
    await userEvent.type(within(dialog).getByLabelText(/^password$/i), 'Manager12345');
    await userEvent.click(within(dialog).getByRole('button', { name: /create manager/i }));

    // Nothing was posted: a manager with no store binding is refused by every
    // store route server-side, so creating one is never useful.
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
    expect(within(dialog).getByText(/choose the store they will run/i)).toBeInTheDocument();
  });

  it('does not offer a password field when editing', async () => {
    stubRoutes([
      { match: '/admin/store-managers', body: paginate([makeStoreManagerAccount()]) },
      { match: '/stores', body: [makeAdminStore()] },
    ]);

    renderWithProviders(<AdminStoreManagersScreen />);
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    const dialog = await screen.findByRole('dialog');
    // Resetting somebody else's credential is a different operation; folding it
    // into an edit form is how it gets done by accident.
    expect(within(dialog).queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    // The login identifier is not editable here either.
    expect(within(dialog).getByLabelText(/phone number/i)).toBeDisabled();
  });

  it('offers no way to change a role', async () => {
    stubRoutes([
      { match: '/admin/store-managers', body: paginate([makeStoreManagerAccount()]) },
      { match: '/stores', body: [makeAdminStore()] },
    ]);

    renderWithProviders(<AdminStoreManagersScreen />);
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText(/role/i)).not.toBeInTheDocument();
  });
});

describe('AdminStoresScreen', () => {
  it('summarises a uniform week rather than repeating seven identical rows', async () => {
    stubRoutes([{ match: '/stores', body: [makeAdminStore()] }]);

    renderWithProviders(<AdminStoresScreen />);

    expect(await screen.findByText('Every day 08:00–23:00')).toBeInTheDocument();
  });

  it('shows coordinates in the human order when editing', async () => {
    stubRoutes([{ match: '/stores', body: [makeAdminStore()] }]);

    renderWithProviders(<AdminStoresScreen />);
    await screen.findByText('FreshCarts Gulberg');

    await userEvent.click(screen.getByRole('button', { name: /edit store/i }));

    const dialog = await screen.findByRole('dialog');
    // Stored as GeoJSON [longitude, latitude]; shown the way a person reads it.
    expect(within(dialog).getByLabelText(/latitude/i)).toHaveValue(31.5102);
    expect(within(dialog).getByLabelText(/longitude/i)).toHaveValue(74.3441);
  });
});

describe('AdminDeliveryPricingScreen', () => {
  it('explains the half-open bounds on every band', async () => {
    stubRoutes([
      { match: '/admin/delivery/pricing-rules', body: makeRuleSet() },
      { match: '/admin/settings', body: makePlatformSettings() },
    ]);

    renderWithProviders(<AdminDeliveryPricingScreen />);

    await screen.findByRole('table');
    // Getting this wrong is the easiest way to misprice a delivery, so the
    // screen states it rather than assuming it is understood.
    expect(screen.getByText(/includes 0 km, excludes 2 km/i)).toBeInTheDocument();
  });

  it('surfaces gaps and overlaps reported by the server', async () => {
    stubRoutes([
      {
        match: '/admin/delivery/pricing-rules',
        body: makeRuleSet({
          problems: [{ kind: 'GAP', message: 'No rule covers 2000-5000 m' }],
        }),
      },
      { match: '/admin/settings', body: makePlatformSettings() },
    ]);

    renderWithProviders(<AdminDeliveryPricingScreen />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No rule covers 2000-5000 m');
  });

  it('refuses an inverted range before sending it', async () => {
    const { requests } = stubRoutes([
      { match: '/admin/delivery/pricing-rules', body: makeRuleSet() },
      { match: '/admin/settings', body: makePlatformSettings() },
    ]);

    renderWithProviders(<AdminDeliveryPricingScreen />);
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: /add band/i }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/band name/i), 'Backwards');
    await userEvent.type(within(dialog).getByLabelText(/from \(km\)/i), '5');
    await userEvent.type(within(dialog).getByLabelText(/up to \(km\)/i), '2');
    await userEvent.type(within(dialog).getByLabelText(/fee/i), '100');
    await userEvent.click(within(dialog).getByRole('button', { name: /add band/i }));

    expect(requests.some((request) => request.method === 'POST')).toBe(false);
    expect(
      within(dialog).getByText(/upper distance must be greater than the lower one/i),
    ).toBeInTheDocument();
  });

  it('converts kilometres to metres on submit', async () => {
    const { requests } = stubRoutes([
      { match: '/admin/delivery/pricing-rules', body: makeRuleSet() },
      { match: '/admin/settings', body: makePlatformSettings() },
    ]);

    renderWithProviders(<AdminDeliveryPricingScreen />);
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: /add band/i }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/band name/i), 'Far');
    await userEvent.type(within(dialog).getByLabelText(/from \(km\)/i), '12');
    await userEvent.type(within(dialog).getByLabelText(/up to \(km\)/i), '18');
    await userEvent.type(within(dialog).getByLabelText(/fee/i), '250');
    await userEvent.click(within(dialog).getByRole('button', { name: /add band/i }));

    await waitFor(() => {
      const post = requests.find((request) => request.method === 'POST');
      // The admin thinks in km, the engine measures roads in metres.
      expect(post?.body).toMatchObject({ minDistanceMeters: 12_000, maxDistanceMeters: 18_000 });
    });
  });
});

describe('AdminSettingsScreen', () => {
  it('separates business settings from deployment facts', async () => {
    stubRoutes([
      { match: '/admin/settings', body: makePlatformSettings() },
      { match: '/admin/audit-logs', body: paginate([makeAuditEntry()]) },
    ]);

    renderWithProviders(<AdminSettingsScreen />);

    await screen.findByLabelText(/maximum delivery distance/i);

    // Editable: business configuration (section 25).
    expect(screen.getByLabelText(/maximum delivery distance/i)).toBeEnabled();
    // Read-only: environment configuration, changed by a redeploy.
    expect(screen.getByText('Distance provider')).toBeInTheDocument();
    expect(screen.getByText('OSRM (measured roads)')).toBeInTheDocument();
  });

  it('converts the radius to metres on save', async () => {
    const { requests } = stubRoutes([
      { match: '/admin/settings', body: makePlatformSettings() },
      { match: '/admin/audit-logs', body: paginate([]) },
    ]);

    renderWithProviders(<AdminSettingsScreen />);

    const radius = await screen.findByLabelText(/maximum delivery distance/i);
    await userEvent.clear(radius);
    await userEvent.type(radius, '8');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      const patch = requests.find((request) => request.method === 'PATCH');
      expect(patch?.body).toMatchObject({ maxDeliveryDistanceMeters: 8_000 });
    });
  });

  it('refuses an impossible radius rather than sending it', async () => {
    const { requests } = stubRoutes([
      { match: '/admin/settings', body: makePlatformSettings() },
      { match: '/admin/audit-logs', body: paginate([]) },
    ]);

    renderWithProviders(<AdminSettingsScreen />);

    const radius = await screen.findByLabelText(/maximum delivery distance/i);
    await userEvent.clear(radius);
    await userEvent.type(radius, '0');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(requests.some((request) => request.method === 'PATCH')).toBe(false);
    expect(screen.getByText(/between 0.5 km and 100 km/i)).toBeInTheDocument();
  });

  it('renders the audit trail in plain language', async () => {
    stubRoutes([
      { match: '/admin/settings', body: makePlatformSettings() },
      { match: '/admin/audit-logs', body: paginate([makeAuditEntry()]) },
    ]);

    renderWithProviders(<AdminSettingsScreen />);

    // Section 46 applies to staff screens too: the enum stays in the database.
    expect(await screen.findByText(/changed whether a product is on sale/i)).toBeInTheDocument();
    expect(screen.queryByText('PRODUCT_STATUS_CHANGED')).not.toBeInTheDocument();
  });
});

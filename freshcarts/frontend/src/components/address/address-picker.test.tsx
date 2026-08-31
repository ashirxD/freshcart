import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeAddress } from '@/test/fixtures';
import { renderWithProviders, signIn } from '@/test/render';
import { AddressPicker } from './address-picker';

/** Serves the address list from a stubbed fetch, as the real API would. */
function stubAddresses(addresses: unknown[]) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(addresses), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
}

describe('AddressPicker', () => {
  // The session and any global stubs are reset by the shared teardown, after
  // the tree has been unmounted.
  beforeEach(() => signIn());

  it('lists saved addresses with the details a shopper recognises', async () => {
    vi.stubGlobal('fetch', stubAddresses([makeAddress()]));

    renderWithProviders(<AddressPicker selectedId={null} onSelect={vi.fn()} />);

    expect(await screen.findByText('Home')).toBeInTheDocument();
    expect(
      screen.getByText('42-B, Street 4, Salamatpura, Lahore (near Opposite Al-Fatah)'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ayesha Khan · \+923001234569/)).toBeInTheDocument();
  });

  it('marks the default address', async () => {
    vi.stubGlobal('fetch', stubAddresses([makeAddress()]));

    renderWithProviders(<AddressPicker selectedId={null} onSelect={vi.fn()} />);

    expect(await screen.findByText('Default')).toBeInTheDocument();
  });

  it('reports the chosen address', async () => {
    const onSelect = vi.fn();
    vi.stubGlobal('fetch', stubAddresses([makeAddress()]));

    renderWithProviders(<AddressPicker selectedId={null} onSelect={onSelect} />);

    await userEvent.click(await screen.findByRole('radio'));

    expect(onSelect).toHaveBeenCalledWith('addr-1');
  });

  it('shows an address with no map location but will not let it be chosen', async () => {
    const onSelect = vi.fn();
    vi.stubGlobal(
      'fetch',
      stubAddresses([
        makeAddress({
          id: 'addr-2',
          hasCoordinates: false,
          latitude: null,
          longitude: null,
        }),
      ]),
    );

    renderWithProviders(<AddressPicker selectedId={null} onSelect={onSelect} />);

    // Hiding it would leave the shopper wondering where their address went;
    // showing it with the reason tells them what to do about it.
    const radio = await screen.findByRole('radio');
    expect(radio).toBeDisabled();
    expect(screen.getByText(/no map location/i)).toBeInTheDocument();

    await userEvent.click(radio);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('offers a way to add one when there are none', async () => {
    vi.stubGlobal('fetch', stubAddresses([]));

    renderWithProviders(<AddressPicker selectedId={null} onSelect={vi.fn()} />);

    expect(await screen.findByText(/no saved addresses yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add an address/i })).toBeInTheDocument();
  });

  it('opens the add-address form in a dialog', async () => {
    vi.stubGlobal('fetch', stubAddresses([makeAddress()]));

    renderWithProviders(<AddressPicker selectedId={null} onSelect={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: /add a new address/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText(/who is receiving this order/i)).toBeInTheDocument();
  });

  it('surfaces a selection error to assistive technology', async () => {
    vi.stubGlobal('fetch', stubAddresses([makeAddress()]));

    renderWithProviders(
      <AddressPicker selectedId={null} onSelect={vi.fn()} error="Choose a delivery address" />,
    );

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Choose a delivery address'),
    );
  });
});

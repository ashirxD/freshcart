'use client';

import { useState } from 'react';
import { Building2, Home, MapPin, MapPinOff, Plus, Star, Trash2, UserRound } from 'lucide-react';
import { AddressForm } from '@/components/address/address-form';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAddresses,
  useCreateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
  useUpdateAddress,
} from '@/features/addresses/addresses.hooks';
import { toAddressForm } from '@/lib/validation/address.schema';
import { useAuthStore } from '@/store/auth.store';
import type { Address, AddressLabel } from '@/types/address';

const LABEL_ICON: Record<AddressLabel, typeof Home> = {
  HOME: Home,
  WORK: Building2,
  OTHER: MapPin,
};

type Editing = { kind: 'none' } | { kind: 'new' } | { kind: 'edit'; address: Address };

/**
 * The address book.
 *
 * Separate from checkout on purpose: fixing an address without a cart in
 * progress is a real thing shoppers do, and it is where the checkout flow sends
 * them when an address turns out to be missing its map location.
 */
export function AddressesScreen() {
  const sessionStatus = useAuthStore((state) => state.status);
  const [editing, setEditing] = useState<Editing>({ kind: 'none' });
  const [pendingDelete, setPendingDelete] = useState<Address | null>(null);

  const { data: addresses, isPending, isError, error, refetch } = useAddresses();
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const setDefault = useSetDefaultAddress();
  const deleteAddress = useDeleteAddress();

  if (sessionStatus === 'loading') {
    return (
      <Container className="flex flex-col gap-gutter py-lg">
        <Skeleton className="h-8 w-48" label="Loading your addresses" />
        <Skeleton className="h-28 w-full" />
      </Container>
    );
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <Container className="py-lg">
        <h1 id="main-content" className="text-xl font-semibold text-text">
          Your addresses
        </h1>
        <EmptyState
          icon={<UserRound className="size-7" aria-hidden="true" />}
          title="Sign in to manage your addresses"
          description="Saved addresses make checkout a couple of taps."
          action={
            <ButtonLink href="/login?next=%2Faddresses" variant="primary">
              Sign in
            </ButtonLink>
          }
          className="mt-lg rounded-lg bg-surface-muted"
        />
      </Container>
    );
  }

  return (
    <Container className="flex flex-col gap-lg py-lg">
      <header className="flex flex-wrap items-center justify-between gap-gutter">
        <h1 id="main-content" className="text-xl font-semibold text-text">
          Your addresses
        </h1>

        {addresses && addresses.length > 0 ? (
          <Button
            onClick={() => setEditing({ kind: 'new' })}
            leadingIcon={<Plus className="size-4" aria-hidden="true" />}
          >
            Add address
          </Button>
        ) : null}
      </header>

      {isPending ? <Skeleton className="h-28 w-full" label="Loading your addresses" /> : null}
      {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {addresses && addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin className="size-7" aria-hidden="true" />}
          title="No saved addresses"
          description="Add one now and it will be ready the next time you check out."
          action={
            <Button
              onClick={() => setEditing({ kind: 'new' })}
              leadingIcon={<Plus className="size-4" aria-hidden="true" />}
            >
              Add an address
            </Button>
          }
          className="rounded-lg bg-surface-muted"
        />
      ) : null}

      {addresses && addresses.length > 0 ? (
        <ul className="flex list-none flex-col gap-gutter">
          {addresses.map((address) => {
            const Icon = LABEL_ICON[address.label];

            return (
              <li
                key={address.id}
                className="flex flex-col gap-gutter rounded-lg border border-outline-variant bg-surface p-gutter"
              >
                <div className="flex items-start gap-gutter">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-primary"
                  >
                    <Icon className="size-5" />
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-text">
                        {address.label.charAt(0) + address.label.slice(1).toLowerCase()}
                        {address.nickname ? ' · ' + address.nickname : ''}
                      </h2>

                      {address.isDefault ? (
                        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          <Star className="size-3" aria-hidden="true" />
                          Default
                        </span>
                      ) : null}
                    </div>

                    <p className="text-sm text-text-muted">{address.formatted}</p>
                    <p className="text-sm text-text-muted">
                      {address.recipientName} · {address.phone}
                    </p>

                    {!address.hasCoordinates ? (
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-danger">
                        <MapPinOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        No map location — delivery to this address cannot be calculated. Edit it to
                        add one.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-xs border-t border-outline-variant pt-gutter">
                  <Button variant="outline" size="sm" onClick={() => setEditing({ kind: 'edit', address })}>
                    Edit
                  </Button>

                  {!address.isDefault ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      isLoading={setDefault.isPending}
                      onClick={() => setDefault.mutate(address.id)}
                    >
                      Make default
                    </Button>
                  ) : null}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="ms-auto text-danger"
                    leadingIcon={<Trash2 className="size-4" aria-hidden="true" />}
                    onClick={() => setPendingDelete(address)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* --- Add / edit ---------------------------------------------------- */}
      <Modal
        open={editing.kind !== 'none'}
        onClose={() => setEditing({ kind: 'none' })}
        title={editing.kind === 'edit' ? 'Edit address' : 'Add an address'}
        description="The map location is what lets us calculate your delivery charge."
      >
        {editing.kind === 'new' ? (
          <AddressForm
            isSubmitting={createAddress.isPending}
            showDefaultToggle={(addresses?.length ?? 0) > 0}
            onCancel={() => setEditing({ kind: 'none' })}
            onSubmit={(input) =>
              createAddress.mutate(input, { onSuccess: () => setEditing({ kind: 'none' }) })
            }
          />
        ) : null}

        {editing.kind === 'edit' ? (
          <AddressForm
            // Keyed by id so switching between two addresses remounts the form
            // rather than leaving the previous one's values behind.
            key={editing.address.id}
            defaultValues={toAddressForm(editing.address)}
            submitLabel="Save changes"
            isSubmitting={updateAddress.isPending}
            showDefaultToggle={!editing.address.isDefault}
            onCancel={() => setEditing({ kind: 'none' })}
            onSubmit={(input) =>
              updateAddress.mutate(
                { id: editing.address.id, values: input },
                { onSuccess: () => setEditing({ kind: 'none' }) },
              )
            }
          />
        ) : null}
      </Modal>

      {/* --- Delete confirmation ------------------------------------------ */}
      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Remove this address?"
        description={
          pendingDelete
            ? pendingDelete.formatted +
              ' will be removed from your address book. Past orders keep their own copy and are not affected.'
            : ''
        }
        footer={
          <div className="flex flex-col-reverse gap-xs sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              isLoading={deleteAddress.isPending}
              onClick={() => {
                if (!pendingDelete) return;
                deleteAddress.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
              }}
            >
              Remove address
            </Button>
          </div>
        }
      />
    </Container>
  );
}

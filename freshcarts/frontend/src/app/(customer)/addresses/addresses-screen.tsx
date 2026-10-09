'use client';

import { useState } from 'react';
import { Building2, Home, MapPin, MapPinOff, Plus, Star, Trash2, UserRound } from 'lucide-react';
import { AddressForm } from '@/components/address/address-form';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { Badge } from '@/components/ui/badge';
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
import { Ltr } from '@/components/common/ltr';
import { useT } from '@/i18n';
import { toAddressForm } from '@/lib/validation/address.schema';
import { useAuthStore } from '@/store/auth.store';
import type { TranslationKey } from '@/i18n';
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
  const t = useT();
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
      <Container className="gap-gutter py-loose flex flex-col">
        <Skeleton className="h-8 w-48" label={t('addresses.loading')} />
        <Skeleton className="h-28 w-full" />
      </Container>
    );
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <Container className="py-wide">
        <h1 className="text-display text-primary">{t('addresses.title')}</h1>
        <EmptyState
          icon={<UserRound aria-hidden="true" />}
          title={t('addresses.signInTitle')}
          description={t('addresses.signInBody')}
          action={
            <ButtonLink href="/login?next=%2Faddresses" variant="primary">
              {t('nav.signIn')}
            </ButtonLink>
          }
          className="mt-loose bg-surface-muted rounded-2xl"
        />
      </Container>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="bg-cream py-loose">
        <Container className="gap-gutter flex flex-wrap items-end justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-eyebrow text-leaf uppercase">{t('addresses.eyebrow')}</p>
            <h1 className="text-display text-primary">{t('addresses.title')}</h1>
          </div>

          {addresses && addresses.length > 0 ? (
            <Button
              onClick={() => setEditing({ kind: 'new' })}
              leadingIcon={<Plus className="size-4" aria-hidden="true" />}
            >
              {t('addresses.add')}
            </Button>
          ) : null}
        </Container>
      </div>

      <Container className="gap-loose py-wide flex flex-col">
        {isPending ? (
          <Skeleton className="h-28 w-full rounded-2xl" label={t('addresses.loading')} />
        ) : null}
        {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

        {addresses && addresses.length === 0 ? (
          <EmptyState
            icon={<MapPin aria-hidden="true" />}
            title={t('addresses.emptyTitle')}
            description={t('addresses.emptyBody')}
            action={
              <Button
                size="lg"
                onClick={() => setEditing({ kind: 'new' })}
                leadingIcon={<Plus className="size-4" aria-hidden="true" />}
              >
                {t('addresses.addAnAddress')}
              </Button>
            }
            className="bg-surface-muted rounded-2xl"
          />
        ) : null}

        {addresses && addresses.length > 0 ? (
          <ul className="gap-gutter flex list-none flex-col">
            {addresses.map((address) => {
              const Icon = LABEL_ICON[address.label];

              return (
                <li
                  key={address.id}
                  className="gap-gutter ring-outline-variant bg-surface p-gutter shadow-card flex flex-col rounded-2xl ring-1"
                >
                  <div className="gap-gutter flex items-start">
                    <span
                      aria-hidden="true"
                      className="bg-cream ring-sand text-primary flex size-11 shrink-0 items-center justify-center rounded-xl ring-1"
                    >
                      <Icon className="size-5" />
                    </span>

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-text font-bold">
                          {t(('addresses.label.' + address.label) as TranslationKey)}
                          {address.nickname ? ' · ' : ''}
                          {address.nickname ? <bdi>{address.nickname}</bdi> : null}
                        </h2>

                        {address.isDefault ? (
                          <Badge tone="brand" icon={<Star className="size-3" aria-hidden="true" />}>
                            {t('addresses.default')}
                          </Badge>
                        ) : null}
                      </div>

                      <p className="text-text-muted text-sm">
                        <bdi>{address.formatted}</bdi>
                      </p>
                      <p className="text-text-muted text-sm">
                        <bdi>{address.recipientName}</bdi> · <Ltr>{address.phone}</Ltr>
                      </p>

                      {!address.hasCoordinates ? (
                        <p className="text-danger bg-danger/8 mt-1.5 flex items-start gap-1.5 rounded-lg p-2 text-sm font-medium">
                          <MapPinOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          {t('addresses.noMapLocation')}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="gap-tight border-outline-variant pt-gutter flex flex-wrap items-center border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing({ kind: 'edit', address })}
                    >
                      {t('addresses.edit')}
                    </Button>

                    {!address.isDefault ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        isLoading={setDefault.isPending}
                        onClick={() => setDefault.mutate(address.id)}
                      >
                        {t('addresses.makeDefault')}
                      </Button>
                    ) : null}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger ms-auto"
                      leadingIcon={<Trash2 className="size-4" aria-hidden="true" />}
                      onClick={() => setPendingDelete(address)}
                    >
                      {t('addresses.remove')}
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
          title={editing.kind === 'edit' ? t('addresses.editTitle') : t('addresses.addTitle')}
          description={t('addresses.locationNote')}
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
              submitLabel={t('addresses.saveChanges')}
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
          title={t('addresses.removeTitle')}
          description={
            pendingDelete ? t('addresses.removeBody', { address: pendingDelete.formatted }) : ''
          }
          footer={
            <div className="gap-tight flex flex-col-reverse sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setPendingDelete(null)}>
                {t('addresses.keepIt')}
              </Button>
              <Button
                variant="danger"
                isLoading={deleteAddress.isPending}
                onClick={() => {
                  if (!pendingDelete) return;
                  deleteAddress.mutate(pendingDelete.id, {
                    onSuccess: () => setPendingDelete(null),
                  });
                }}
              >
                {t('addresses.removeAddress')}
              </Button>
            </div>
          }
        />
      </Container>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Building2, Home, MapPin, Plus } from 'lucide-react';
import { AddressForm } from '@/components/address/address-form';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { RadioCard, RadioCardGroup } from '@/components/ui/radio-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAddresses, useCreateAddress } from '@/features/addresses/addresses.hooks';
import { Ltr } from '@/components/common/ltr';
import { useT, type TFunction, type TranslationKey } from '@/i18n';
import type { Address, AddressLabel } from '@/types/address';

export interface AddressPickerProps {
  selectedId: string | null;
  onSelect: (addressId: string) => void;
  error?: string;
}

const LABEL_ICON: Record<AddressLabel, typeof Home> = {
  HOME: Home,
  WORK: Building2,
  OTHER: MapPin,
};

function addressTitle(address: Address, t: TFunction): string {
  const kind = t(('addresses.label.' + address.label) as TranslationKey);
  return address.nickname ? kind + ' · ' + address.nickname : kind;
}

/**
 * Choose a saved address, or add one.
 *
 * An address without coordinates is shown but not selectable, with the reason
 * stated on the card. Hiding it would be worse: the shopper would wonder where
 * their address went, rather than learning that it needs a map location and
 * that they can fix it.
 */
export function AddressPicker({ selectedId, onSelect, error }: AddressPickerProps) {
  const t = useT();
  const [isAdding, setIsAdding] = useState(false);
  const { data: addresses, isPending, isError, error: loadError, refetch } = useAddresses();
  const createAddress = useCreateAddress();

  if (isPending) {
    return (
      <div className="gap-tight flex flex-col">
        <Skeleton className="h-24 w-full" label={t('addresses.loading')} />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState error={loadError} onRetry={() => void refetch()} />;
  }

  const openAddForm = () => setIsAdding(true);

  return (
    <div className="gap-gutter flex flex-col">
      {addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin className="size-7" aria-hidden="true" />}
          title={t('addresses.emptyTitle')}
          description={t('addresses.picker.emptyBody')}
          action={
            <Button
              onClick={openAddForm}
              leadingIcon={<Plus className="size-4" aria-hidden="true" />}
            >
              {t('addresses.addAnAddress')}
            </Button>
          }
          className="bg-surface-muted rounded-lg"
        />
      ) : (
        <>
          <RadioCardGroup
            label={t('addresses.picker.question')}
            hideLabel
            value={selectedId}
            onChange={onSelect}
            error={error}
          >
            <div className="gap-tight flex flex-col">
              {addresses.map((address) => {
                const Icon = LABEL_ICON[address.label];

                return (
                  <RadioCard
                    key={address.id}
                    value={address.id}
                    title={addressTitle(address, t)}
                    icon={<Icon className="size-5" />}
                    disabled={!address.hasCoordinates}
                    disabledReason={t('addresses.picker.noMapReason')}
                    trailing={
                      address.isDefault ? (
                        <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                          {t('addresses.default')}
                        </span>
                      ) : null
                    }
                  >
                    <span className="text-text-muted mt-0.5 flex flex-col gap-0.5 text-sm">
                      <span>
                        <bdi>{address.formatted}</bdi>
                      </span>
                      <span>
                        <bdi>{address.recipientName}</bdi> · <Ltr>{address.phone}</Ltr>
                      </span>
                    </span>
                  </RadioCard>
                );
              })}
            </div>
          </RadioCardGroup>

          <Button
            variant="outline"
            onClick={openAddForm}
            leadingIcon={<Plus className="size-4" aria-hidden="true" />}
            className="self-start"
          >
            {t('addresses.picker.addNew')}
          </Button>
        </>
      )}

      <Modal
        open={isAdding}
        onClose={() => setIsAdding(false)}
        title={t('addresses.picker.addTitle')}
        description={t('addresses.picker.addBody')}
      >
        <AddressForm
          isSubmitting={createAddress.isPending}
          onCancel={() => setIsAdding(false)}
          showDefaultToggle={addresses.length > 0}
          onSubmit={(input) =>
            createAddress.mutate(input, {
              onSuccess: (created) => {
                setIsAdding(false);
                // Selecting it immediately is the point of adding it — but only
                // if it can actually be delivered to.
                if (created.hasCoordinates) onSelect(created.id);
              },
            })
          }
        />
      </Modal>
    </div>
  );
}

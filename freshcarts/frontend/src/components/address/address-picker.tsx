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

function addressTitle(address: Address): string {
  const kind = address.label.charAt(0) + address.label.slice(1).toLowerCase();
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
  const [isAdding, setIsAdding] = useState(false);
  const { data: addresses, isPending, isError, error: loadError, refetch } = useAddresses();
  const createAddress = useCreateAddress();

  if (isPending) {
    return (
      <div className="gap-tight flex flex-col">
        <Skeleton className="h-24 w-full" label="Loading your addresses" />
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
          title="No saved addresses yet"
          description="Add where you would like this order delivered."
          action={
            <Button
              onClick={openAddForm}
              leadingIcon={<Plus className="size-4" aria-hidden="true" />}
            >
              Add an address
            </Button>
          }
          className="bg-surface-muted rounded-lg"
        />
      ) : (
        <>
          <RadioCardGroup
            label="Where should we deliver this order?"
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
                    title={addressTitle(address)}
                    icon={<Icon className="size-5" />}
                    disabled={!address.hasCoordinates}
                    disabledReason="This address has no map location, so we cannot work out a delivery charge. Edit it to add one."
                    trailing={
                      address.isDefault ? (
                        <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                          Default
                        </span>
                      ) : null
                    }
                  >
                    <span className="text-text-muted mt-0.5 flex flex-col gap-0.5 text-sm">
                      <span>{address.formatted}</span>
                      <span>
                        {address.recipientName} · {address.phone}
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
            Add a new address
          </Button>
        </>
      )}

      <Modal
        open={isAdding}
        onClose={() => setIsAdding(false)}
        title="Add a delivery address"
        description="We will use this to calculate your delivery charge."
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

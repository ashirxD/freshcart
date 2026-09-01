'use client';

import { ButtonLink } from '@/components/ui/button-link';
import { RouteError } from '@/components/common/route-error';

/**
 * The store console boundary.
 *
 * "Nothing has been changed" is the important sentence: staff mid-way through
 * packing an order need to know a failed screen did not half-apply something
 * (§51).
 */
export default function StoreManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="This screen could not load"
      description="Something went wrong at our end. No order or stock level has been changed."
      secondaryAction={
        <ButtonLink href="/store-manager" variant="outline">
          Back to the dashboard
        </ButtonLink>
      }
    />
  );
}

'use client';

import { ButtonLink } from '@/components/ui/button-link';
import { RouteError } from '@/components/common/route-error';

/**
 * The back office boundary. A failure here leaves the storefront untouched —
 * the two route groups have separate boundaries for exactly that reason.
 */
export default function AdminError({
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
      title="This admin screen could not load"
      description="Something went wrong at our end. Nothing you were viewing has been changed."
      secondaryAction={
        <ButtonLink href="/admin" variant="outline">
          Back to the dashboard
        </ButtonLink>
      }
    />
  );
}

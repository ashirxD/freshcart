'use client';

import { ButtonLink } from '@/components/ui/button-link';
import { RouteError } from '@/components/common/route-error';

/**
 * The storefront boundary.
 *
 * Wording chosen for a shopper, not a developer: no status code, no stack, and
 * a route out that leads somewhere they can actually shop from (§46, §50).
 */
export default function CustomerError({
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
      title="Something went wrong"
      description="We could not load this page. Your cart and your orders are safe."
      secondaryAction={
        <ButtonLink href="/" variant="outline">
          Browse products
        </ButtonLink>
      }
    />
  );
}

'use client';

import { ButtonLink } from '@/components/ui/button-link';
import { RouteError } from '@/components/common/route-error';
import { useT } from '@/i18n';

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
  const t = useT();

  return (
    <RouteError
      error={error}
      reset={reset}
      title={t('states.somethingWentWrong')}
      description={t('errorPage.customerBody')}
      secondaryAction={
        <ButtonLink href="/" variant="outline">
          {t('errorPage.browse')}
        </ButtonLink>
      }
    />
  );
}

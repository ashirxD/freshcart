'use client';

import { ButtonLink } from '@/components/ui/button-link';
import { RouteError } from '@/components/common/route-error';
import { useT } from '@/i18n';

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
  const t = useT();

  return (
    <RouteError
      error={error}
      reset={reset}
      title={t('store.error.title')}
      description={t('store.error.body')}
      secondaryAction={
        <ButtonLink href="/store-manager" variant="outline">
          {t('store.error.backToDashboard')}
        </ButtonLink>
      }
    />
  );
}

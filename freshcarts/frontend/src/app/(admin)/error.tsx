'use client';

import { ButtonLink } from '@/components/ui/button-link';
import { RouteError } from '@/components/common/route-error';
import { useT } from '@/i18n';

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
  const t = useT();

  return (
    <RouteError
      error={error}
      reset={reset}
      title={t('admin.error.title')}
      description={t('admin.error.body')}
      secondaryAction={
        <ButtonLink href="/admin" variant="outline">
          {t('admin.error.backToDashboard')}
        </ButtonLink>
      }
    />
  );
}

import { FileQuestion } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ButtonLink } from '@/components/ui/button-link';
import { getT } from '@/i18n/server';

/** A mistyped admin URL, answered with a way back rather than a blank page. */
export default async function AdminNotFound() {
  const t = await getT();

  return (
    <div className="px-page py-loose mx-auto w-full max-w-md">
      <EmptyState
        icon={<FileQuestion aria-hidden="true" />}
        title={t('admin.error.notFoundTitle')}
        description={t('admin.error.notFoundBody')}
        action={<ButtonLink href="/admin">{t('admin.error.backToDashboard')}</ButtonLink>}
        className="bg-surface-muted rounded-2xl"
      />
    </div>
  );
}

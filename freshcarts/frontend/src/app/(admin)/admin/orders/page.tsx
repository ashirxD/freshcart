import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/skeleton';
import { getT } from '@/i18n/server';
import { AdminOrdersScreen } from './orders-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('admin.nav.orders') };
}

/**
 * `useSearchParams` in the screen makes this route dynamic, so the Suspense
 * boundary is required rather than decorative — without it the whole route
 * opts out of static rendering with a build-time error.
 */
export default async function Page() {
  const t = await getT();

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" label={t('admin.orders.loadingLabel')} />}>
      <AdminOrdersScreen />
    </Suspense>
  );
}

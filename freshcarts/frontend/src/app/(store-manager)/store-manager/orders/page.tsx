import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';
import { getT } from '@/i18n/server';
import { OrdersScreen } from './orders-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('store.shell.orders') };
}

/** `useSearchParams` needs a Suspense boundary so the shell can render first. */
export default async function Page() {
  const t = await getT();

  return (
    <Suspense
      fallback={
        <Container className="gap-gutter flex flex-col">
          <Skeleton className="h-7 w-40" label={t('store.dashboard.loadingOrders')} />
          <Skeleton className="h-64 w-full" />
        </Container>
      }
    >
      <OrdersScreen />
    </Suspense>
  );
}

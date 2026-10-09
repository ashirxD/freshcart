import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';
import { getT } from '@/i18n/server';
import { InventoryScreen } from './inventory-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('store.shell.inventory') };
}

export default async function Page() {
  const t = await getT();

  return (
    <Suspense
      fallback={
        <Container className="gap-gutter flex flex-col">
          <Skeleton className="h-7 w-40" label={t('store.inventory.loading')} />
          <Skeleton className="h-64 w-full" />
        </Container>
      }
    >
      <InventoryScreen />
    </Suspense>
  );
}

import { Suspense } from 'react';
import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';
import { InventoryScreen } from './inventory-screen';

export const metadata = { title: 'Inventory' };

export default function Page() {
  return (
    <Suspense
      fallback={
        <Container className="gap-gutter flex flex-col">
          <Skeleton className="h-7 w-40" label="Loading inventory" />
          <Skeleton className="h-64 w-full" />
        </Container>
      }
    >
      <InventoryScreen />
    </Suspense>
  );
}

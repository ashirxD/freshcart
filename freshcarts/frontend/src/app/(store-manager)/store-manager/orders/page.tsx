import { Suspense } from 'react';
import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';
import { OrdersScreen } from './orders-screen';

export const metadata = { title: 'Orders' };

/** `useSearchParams` needs a Suspense boundary so the shell can render first. */
export default function Page() {
  return (
    <Suspense
      fallback={
        <Container className="gap-gutter flex flex-col">
          <Skeleton className="h-7 w-40" label="Loading orders" />
          <Skeleton className="h-64 w-full" />
        </Container>
      }
    >
      <OrdersScreen />
    </Suspense>
  );
}

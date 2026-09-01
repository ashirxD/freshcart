import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminOrdersScreen } from './orders-screen';

export const metadata = { title: 'Orders' };

/**
 * `useSearchParams` in the screen makes this route dynamic, so the Suspense
 * boundary is required rather than decorative — without it the whole route
 * opts out of static rendering with a build-time error.
 */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" label="Loading orders" />}>
      <AdminOrdersScreen />
    </Suspense>
  );
}

import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';

/** Keeps the console shell in place while a store screen resolves. */
export default function StoreManagerLoading() {
  return (
    <Container className="gap-gutter py-lg flex flex-col">
      <Skeleton className="h-7 w-56" label="Loading" />
      <div className="gap-gutter grid grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </Container>
  );
}

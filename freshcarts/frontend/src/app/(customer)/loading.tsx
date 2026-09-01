import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';

/** Keeps the shell in place while a customer page resolves. */
export default function CustomerLoading() {
  return (
    <Container className="gap-gutter py-lg flex flex-col">
      <Skeleton className="h-7 w-48" label="Loading" />
      <Skeleton className="h-12 w-full" />
      <div className="gap-gutter grid grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-52 w-full" />
        ))}
      </div>
    </Container>
  );
}

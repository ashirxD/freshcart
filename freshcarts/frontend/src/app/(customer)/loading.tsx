import { Container } from '@/components/layout/container';
import { ProductGridSkeleton } from '@/components/product/product-grid';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Keeps the shell in place while a customer page resolves.
 *
 * Shaped like the pages it stands in for — a tinted header band, then a grid —
 * so navigation reads as the next page arriving rather than as the app blinking.
 */
export default function CustomerLoading() {
  return (
    <div className="flex flex-col">
      <div className="bg-cream py-loose">
        <Container className="gap-snug flex flex-col">
          <Skeleton className="h-3 w-28" label="Loading" />
          <Skeleton className="h-9 w-64" />
        </Container>
      </div>

      <Container className="gap-loose py-wide flex flex-col">
        <ProductGridSkeleton count={10} />
      </Container>
    </div>
  );
}

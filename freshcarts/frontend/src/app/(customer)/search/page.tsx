import { Suspense } from 'react';
import { Container } from '@/components/layout/container';
import { ProductGridSkeleton } from '@/components/product/product-grid';
import { SearchScreen } from './search-screen';

export const metadata = { title: 'Search' };

/**
 * `useSearchParams` needs a Suspense boundary so the rest of the shell can be
 * rendered statically while the client reads the query string.
 */
export default function Page() {
  return (
    <Suspense
      fallback={
        <Container className="py-loose">
          <ProductGridSkeleton />
        </Container>
      }
    >
      <SearchScreen />
    </Suspense>
  );
}

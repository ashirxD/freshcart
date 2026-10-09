import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { Suspense } from 'react';
import { Container } from '@/components/layout/container';
import { ProductGridSkeleton } from '@/components/product/product-grid';
import { SearchScreen } from './search-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('nav.search') };
}

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

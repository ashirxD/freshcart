import { Search } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Container } from '@/components/layout/container';

export const metadata = { title: 'Search' };

/**
 * Route placeholder so the primary navigation is fully walkable during the
 * foundation phase. Replaced by the real screen when the products module lands.
 */
export default function Page() {
  return (
    <Container className="py-lg">
      <h1 id="main-content" className="text-xl font-semibold text-text">
        Search
      </h1>
      <EmptyState
        icon={<Search className="size-7" aria-hidden="true" />}
        title="Coming next"
        description="Product search arrives with the catalogue module."
        className="mt-lg rounded-lg bg-surface-muted"
      />
    </Container>
  );
}

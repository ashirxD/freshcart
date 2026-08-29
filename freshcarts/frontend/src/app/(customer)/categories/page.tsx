import { Grid3x3 } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Container } from '@/components/layout/container';

export const metadata = { title: 'Categories' };

/**
 * Route placeholder so the primary navigation is fully walkable during the
 * foundation phase. Replaced by the real screen when the categories module lands.
 */
export default function Page() {
  return (
    <Container className="py-lg">
      <h1 id="main-content" className="text-xl font-semibold text-text">
        Categories
      </h1>
      <EmptyState
        icon={<Grid3x3 className="size-7" aria-hidden="true" />}
        title="Coming next"
        description="Categories are loaded from the API once the categories module is connected."
        className="mt-lg rounded-lg bg-surface-muted"
      />
    </Container>
  );
}

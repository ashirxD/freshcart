import { Receipt } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Container } from '@/components/layout/container';

export const metadata = { title: 'Your orders' };

/**
 * Route placeholder so the primary navigation is fully walkable during the
 * foundation phase. Replaced by the real screen when the orders module lands.
 */
export default function Page() {
  return (
    <Container className="py-lg">
      <h1 id="main-content" className="text-xl font-semibold text-text">
        Your orders
      </h1>
      <EmptyState
        icon={<Receipt className="size-7" aria-hidden="true" />}
        title="Coming next"
        description="Your order history will appear here once the orders module is connected."
        className="mt-lg rounded-lg bg-surface-muted"
      />
    </Container>
  );
}

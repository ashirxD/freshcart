import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import type { Product } from '@/types/catalog';
import { ProductCard } from './product-card';

export interface ProductGridProps {
  products: Product[];
  className?: string;
  /** Cards rendered eagerly at the top of the page. */
  priorityCount?: number;
}

/**
 * The catalogue grid.
 *
 * Two columns on a phone widening to five on a desktop — a genuine desktop
 * layout inside a max-width column, not two stretched mobile columns. The
 * mobile gutter is tightened to 12px so two cards still get usable width at
 * 320px without the page margin collapsing.
 */
export function ProductGrid({ products, className, priorityCount = 4 }: ProductGridProps) {
  return (
    <ul
      className={cn(
        'gap-snug sm:gap-gutter grid grid-cols-2',
        'sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
        className,
      )}
    >
      {products.map((product, index) => (
        <li key={product.id} className="flex">
          <ProductCard product={product} priority={index < priorityCount} className="w-full" />
        </li>
      ))}
    </ul>
  );
}

/** Matches the card's shape exactly, so nothing shifts when the data lands. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul
      className="gap-snug sm:gap-gutter grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <li key={index}>
          <ProductCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

/** One card-shaped placeholder. Shared by the grid and the rails. */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'ring-outline-variant/70 bg-surface flex h-full flex-col overflow-hidden rounded-xl ring-1',
        className,
      )}
    >
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="p-snug flex flex-col gap-2">
        <Skeleton className="h-2.5 w-1/2" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-2.5 w-1/3" />
        <Skeleton className="mt-1 h-5 w-2/3" />
        <Skeleton className="h-touch w-full rounded-lg" />
      </div>
    </div>
  );
}

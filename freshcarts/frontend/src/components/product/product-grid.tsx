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
 * Two columns on a phone with a 16px gutter, as the design specifies, widening
 * to five on a desktop — a genuine desktop layout inside a max-width column,
 * not two stretched mobile columns.
 */
export function ProductGrid({ products, className, priorityCount = 4 }: ProductGridProps) {
  return (
    <ul
      className={cn(
        'gap-gutter grid grid-cols-2',
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
      className="gap-gutter grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <li key={index}>
          <div className="border-outline-variant bg-surface flex h-full flex-col overflow-hidden rounded-lg border">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="flex flex-col gap-2 p-3">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-10 w-full rounded-full" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A horizontally scrolling rail, used by the home page sections. */
export function ProductRail({ products }: { products: Product[] }) {
  return (
    <ul
      className={cn(
        'gap-gutter flex snap-x snap-mandatory overflow-x-auto pb-2',
        // Bleed to the screen edge on mobile so the rail reads as scrollable,
        // with padding that restores the page margin.
        '-mx-page px-page md:-mx-8 md:px-8',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
    >
      {products.map((product, index) => (
        <li key={product.id} className="w-40 shrink-0 snap-start sm:w-48">
          <ProductCard product={product} priority={index < 2} />
        </li>
      ))}
    </ul>
  );
}

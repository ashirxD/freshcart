import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import type { Category } from '@/types/catalog';
import { CategoryIcon } from './category-icon';

export interface CategoryCardProps {
  category: Category;
  className?: string;
}

/**
 * A category tile. Every value shown comes from the API — nothing about the
 * category list is hardcoded in the frontend.
 */
export function CategoryCard({ category, className }: CategoryCardProps) {
  return (
    <Link
      href={'/categories/' + category.slug}
      className={cn(
        'min-h-touch flex flex-col items-center gap-2 rounded-lg p-3 text-center',
        'border-outline-variant bg-surface shadow-card border',
        'hover:shadow-raised transition-shadow',
        className,
      )}
    >
      <span className="bg-surface-muted text-primary flex size-12 items-center justify-center rounded-full">
        <CategoryIcon name={category.icon} />
      </span>

      <span className="text-text text-sm leading-tight font-medium">{category.name}</span>

      {category.productCount !== undefined ? (
        <span className="text-text-muted text-xs">
          {category.productCount === 1 ? '1 item' : category.productCount + ' items'}
        </span>
      ) : null}
    </Link>
  );
}

export interface CategoryGridProps {
  categories: Category[];
  className?: string;
}

export function CategoryGrid({ categories, className }: CategoryGridProps) {
  return (
    <ul className={cn('gap-gutter grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6', className)}>
      {categories.map((category) => (
        <li key={category.id} className="flex">
          <CategoryCard category={category} className="w-full" />
        </li>
      ))}
    </ul>
  );
}

/** Scrollable shortcuts row for the home page. */
export function CategoryRail({ categories }: { categories: Category[] }) {
  return (
    <ul
      className={cn(
        'gap-gutter flex snap-x overflow-x-auto pb-2',
        '-mx-page px-page md:-mx-8 md:px-8',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
    >
      {categories.map((category) => (
        <li key={category.id} className="w-24 shrink-0 snap-start">
          <CategoryCard category={category} className="h-full" />
        </li>
      ))}
    </ul>
  );
}

export function CategoryGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className="gap-gutter grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <li key={index}>
          <div className="border-outline-variant bg-surface flex flex-col items-center gap-2 rounded-lg border p-3">
            <Skeleton className="size-12 rounded-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}

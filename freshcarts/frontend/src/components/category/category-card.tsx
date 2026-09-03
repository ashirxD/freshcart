import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import type { Category } from '@/types/catalog';
import { CategoryIcon } from './category-icon';
import { categoryTone } from './category-tone';

export interface CategoryCardProps {
  category: Category;
  className?: string;
}

/**
 * A category tile. Every value shown comes from the API — nothing about the
 * category list is hardcoded in the frontend.
 *
 * The old tile was a white rectangle with a grey circle in it, and eight of
 * them in a row said nothing at all. This one is a coloured wash with the icon
 * floating on a translucent disc, the name set left rather than centred, and
 * the item count as a quiet second line — a shelf label rather than a button.
 *
 * ONE COMPONENT, TWO SIZES
 * It is compact on a phone and full-height from `sm` up, by responsive class
 * rather than by a `variant` prop. That matters beyond tidiness: the two sizes
 * used to be two renders of the whole list, so every category link existed
 * twice in the DOM with one copy display-none'd.
 *
 * The hover is 3px of lift and one step of extra wash (§21). Nothing scales:
 * eight tiles growing under the cursor is noise, not delight.
 */
export function CategoryCard({ category, className }: CategoryCardProps) {
  const tone = categoryTone(category.slug);

  return (
    <Link
      href={'/categories/' + category.slug}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl',
        'ring-outline-variant/60 ring-1',
        'ease-standard transition-[transform,box-shadow,background-color] duration-200',
        'hover:shadow-raised hover:-translate-y-[3px] active:translate-y-0',
        'min-h-touch sm:gap-loose sm:p-gutter gap-1.5 p-3 sm:min-h-32',
        tone.surface,
        tone.surfaceHover,
        className,
      )}
    >
      <span
        className={cn(
          'shadow-inset-tile flex shrink-0 items-center justify-center rounded-xl',
          'ease-standard transition-transform duration-200 group-hover:-rotate-3',
          'size-10 sm:size-12',
          tone.disc,
          tone.ink,
        )}
      >
        <CategoryIcon name={category.icon} className="size-5 sm:size-6" />
      </span>

      <span className="mt-auto flex flex-col gap-0.5">
        <span className="text-text sm:text-card text-[0.8125rem] leading-tight font-bold tracking-[-0.01em]">
          {category.name}
        </span>

        {category.productCount !== undefined ? (
          <span className="text-text-muted text-xs font-medium">
            {category.productCount === 1 ? '1 item' : category.productCount + ' items'}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export interface CategoryGridProps {
  categories: Category[];
  className?: string;
}

export function CategoryGrid({ categories, className }: CategoryGridProps) {
  return (
    <ul
      className={cn(
        'gap-snug sm:gap-gutter grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
        className,
      )}
    >
      {categories.map((category) => (
        <li key={category.id} className="flex">
          <CategoryCard category={category} className="w-full" />
        </li>
      ))}
    </ul>
  );
}

/**
 * The storefront's category row.
 *
 * ONE list that changes shape: a swipeable rail on a phone — one thumb, no grid
 * pushing the products below the fold (§22) — and a proper grid from `sm` up,
 * where there is room to show every aisle at once and a horizontal scrollbar on
 * a mouse would be the wrong control.
 */
export function CategoryRail({ categories }: { categories: Category[] }) {
  return (
    <ul
      className={cn(
        'gap-snug no-scrollbar flex snap-x overflow-x-auto pb-1',
        // Bleeds to the screen edge so the row reads as scrollable, with
        // padding that restores the page margin.
        '-mx-page px-page',
        // From `sm` it is a grid again: no bleed, no scroll, no snap.
        'sm:gap-gutter sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4',
      )}
    >
      {categories.map((category) => (
        <li key={category.id} className="flex w-[7.5rem] shrink-0 snap-start sm:w-auto sm:shrink">
          <CategoryCard category={category} className="w-full" />
        </li>
      ))}
    </ul>
  );
}

export function CategoryGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul
      className="gap-snug sm:gap-gutter grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <li key={index}>
          <div className="ring-outline-variant/60 bg-surface-muted p-gutter gap-loose flex min-h-24 flex-col rounded-xl ring-1 sm:min-h-32">
            <Skeleton className="size-10 rounded-xl sm:size-12" />
            <div className="mt-auto flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

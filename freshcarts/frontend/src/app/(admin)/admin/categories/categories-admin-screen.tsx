'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { StatusPill } from '@/components/admin/status-pill';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { ButtonLink } from '@/components/ui/button-link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAdminCategories,
  useDeleteCategory,
  useReorderCategories,
  useSetCategoryStatus,
} from '@/features/admin/admin.hooks';
import { useI18n } from '@/i18n';
import type { Category } from '@/types/catalog';

/**
 * Category management: create, edit, reorder, deactivate and delete.
 *
 * Reordering is a move-up/move-down pair rather than drag-and-drop. Dragging is
 * unusable with a keyboard and awkward on a touch screen, and the ordering here
 * is a short list — two buttons cover it accessibly.
 */
export function CategoriesAdminScreen() {
  const { t } = useI18n();
  const { data: categories, isPending, isError, error, refetch } = useAdminCategories();

  return (
    <Container className="gap-loose flex flex-col">
      <header className="gap-gutter flex flex-wrap items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-text text-xl font-semibold">{t('admin.categories.title')}</h1>
          <p className="text-text-muted text-sm">{t('admin.categories.subtitle')}</p>
        </div>

        <ButtonLink
          href="/admin/categories/new"
          leadingIcon={<Plus className="size-4" aria-hidden="true" />}
        >
          {t('admin.categories.new')}
        </ButtonLink>
      </header>

      {isPending ? (
        <div className="gap-gutter flex flex-col">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" label={t('admin.categories.loadingRows')} />
          ))}
        </div>
      ) : null}

      {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {categories?.length === 0 ? (
        <p className="bg-surface-muted p-loose text-text-muted rounded-lg text-center text-sm">
          {t('admin.categories.none')}
        </p>
      ) : null}

      {categories && categories.length > 0 ? (
        <ul className="gap-gutter flex flex-col">
          {categories.map((category, index) => (
            <CategoryRow
              key={category.id}
              category={category}
              siblings={categories}
              index={index}
            />
          ))}
        </ul>
      ) : null}
    </Container>
  );
}

function CategoryRow({
  category,
  siblings,
  index,
}: {
  category: Category;
  siblings: Category[];
  index: number;
}) {
  const { t, ltr } = useI18n();
  const [isExpanded, setExpanded] = useState(false);
  const reorder = useReorderCategories();
  const setStatus = useSetCategoryStatus();
  const remove = useDeleteCategory();

  /**
   * Swaps this category's display order with its neighbour and sends both in
   * one request, so the list can never be left half-reordered.
   */
  const move = (direction: -1 | 1) => {
    const neighbour = siblings[index + direction];
    if (!neighbour) return;

    reorder.mutate([
      { id: category.id, displayOrder: neighbour.displayOrder },
      { id: neighbour.id, displayOrder: category.displayOrder },
    ]);
  };

  return (
    <li className="border-outline-variant bg-surface p-gutter rounded-lg border">
      <div className="gap-gutter flex flex-wrap items-start">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => move(-1)}
            disabled={index === 0 || reorder.isPending}
            aria-label={t('admin.categories.moveUp', { name: category.name })}
            className="text-outline hover:bg-surface-muted flex size-9 items-center justify-center rounded-md disabled:opacity-30"
          >
            <ChevronUp className="size-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => move(1)}
            disabled={index === siblings.length - 1 || reorder.isPending}
            aria-label={t('admin.categories.moveDown', { name: category.name })}
            className="text-outline hover:bg-surface-muted flex size-9 items-center justify-center rounded-md disabled:opacity-30"
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-text text-base font-semibold">
              <bdi>{category.name}</bdi>
            </h2>
            <StatusPill isActive={category.isActive} />
          </div>

          <p className="text-text-muted text-sm">
            {t('admin.categories.rowSummary', {
              slug: ltr('/' + category.slug),
              products: t('admin.categories.products', { count: category.productCount ?? 0 }),
              subs: t('admin.categories.subcategories', { count: category.children.length }),
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href={'/admin/categories/' + category.id} variant="outline" size="sm">
            {t('common.edit')}
          </ButtonLink>

          <Button
            variant="outline"
            size="sm"
            isLoading={setStatus.isPending}
            onClick={() => setStatus.mutate({ id: category.id, isActive: !category.isActive })}
          >
            {category.isActive ? t('admin.categories.deactivate') : t('admin.categories.reactivate')}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            isLoading={remove.isPending}
            // The API refuses to delete a category that still holds products or
            // subcategories and explains why, which the error toast surfaces.
            onClick={() => remove.mutate(category.id)}
          >
            {t('admin.products.delete')}
          </Button>

          {category.children.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={isExpanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {isExpanded ? t('admin.categories.hideSubs') : t('admin.categories.showSubs')}
            </Button>
          ) : null}
        </div>
      </div>

      {isExpanded && category.children.length > 0 ? (
        <ul className="mt-gutter border-outline-variant pt-gutter flex flex-col gap-2 border-t">
          {category.children.map((child, childIndex) => (
            <SubcategoryRow
              key={child.id}
              category={child}
              siblings={category.children}
              index={childIndex}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function SubcategoryRow({
  category,
  siblings,
  index,
}: {
  category: Category;
  siblings: Category[];
  index: number;
}) {
  const { t } = useI18n();
  const reorder = useReorderCategories();
  const setStatus = useSetCategoryStatus();

  const move = (direction: -1 | 1) => {
    const neighbour = siblings[index + direction];
    if (!neighbour) return;

    reorder.mutate([
      { id: category.id, displayOrder: neighbour.displayOrder },
      { id: neighbour.id, displayOrder: category.displayOrder },
    ]);
  };

  return (
    <li className="gap-gutter flex flex-wrap items-center ps-6">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={index === 0 || reorder.isPending}
          aria-label={t('admin.categories.moveUp', { name: category.name })}
          className="text-outline hover:bg-surface-muted flex size-9 items-center justify-center rounded-md disabled:opacity-30"
        >
          <ChevronUp className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={index === siblings.length - 1 || reorder.isPending}
          aria-label={t('admin.categories.moveDown', { name: category.name })}
          className="text-outline hover:bg-surface-muted flex size-9 items-center justify-center rounded-md disabled:opacity-30"
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
      </div>

      <span className="text-text flex-1 text-sm font-medium">
        <bdi>{category.name}</bdi>
      </span>
      <StatusPill isActive={category.isActive} />

      <ButtonLink href={'/admin/categories/' + category.id} variant="ghost" size="sm">
        {t('common.edit')}
      </ButtonLink>

      <Button
        variant="ghost"
        size="sm"
        isLoading={setStatus.isPending}
        onClick={() => setStatus.mutate({ id: category.id, isActive: !category.isActive })}
      >
        {category.isActive ? t('admin.categories.deactivate') : t('admin.categories.reactivate')}
      </Button>
    </li>
  );
}

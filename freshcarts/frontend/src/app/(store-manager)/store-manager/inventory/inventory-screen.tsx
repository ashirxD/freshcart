'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Boxes, History } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SearchBar } from '@/components/common/search-bar';
import { Container } from '@/components/layout/container';
import { SetStockDialog, StockHistoryDialog } from '@/components/store-manager/stock-dialogs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useStoreInventory, useUpdateStock } from '@/features/store-manager/store-manager.hooks';
import { useI18n, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/cn';
import { Ltr } from '@/components/common/ltr';
import type { StockStatus } from '@/types/catalog';
import type { StoreInventoryRow } from '@/types/store-manager';

const STATUS_TABS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: 'ALL', labelKey: 'common.all' },
  { value: 'LOW_STOCK', labelKey: 'store.dashboard.lowStock' },
  { value: 'OUT_OF_STOCK', labelKey: 'store.stock.OUT_OF_STOCK' },
  { value: 'IN_STOCK', labelKey: 'store.stock.IN_STOCK' },
];

const STATUS_STYLE: Record<StockStatus, string> = {
  IN_STOCK: 'text-success',
  LOW_STOCK: 'text-secondary',
  OUT_OF_STOCK: 'text-danger',
};

/**
 * Stock management for the manager's own store.
 *
 * The filter lives in the URL so the dashboard's "4 out of stock" tile can link
 * straight to exactly those rows — the count and the list are then guaranteed to
 * agree, because both come from the same server-side definition.
 */
export function InventoryScreen() {
  const { t, tx } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusParam = searchParams.get('status') ?? 'ALL';
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1;
  // Seeded from the URL so a "Stock" link from the products screen lands on the
  // row it names, then owned locally as the manager types.
  const searchParam = searchParams.get('search') ?? '';
  const [search, setSearch] = useState(searchParam);
  const [historyFor, setHistoryFor] = useState<StoreInventoryRow | null>(null);

  const setParam = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === 'ALL') params.delete(key);
        else params.set(key, value);
      }
      if (!('page' in updates)) params.delete('page');

      const query = params.toString();
      router.replace(pathname + (query ? '?' + query : ''), { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const { data, isPending, isError, error, refetch } = useStoreInventory({
    ...(statusParam !== 'ALL' ? { status: statusParam as StockStatus } : {}),
    ...(search ? { search } : {}),
    page,
    limit: 20,
  });

  return (
    <Container className="gap-loose flex flex-col">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-text text-xl font-semibold">{t('store.inventory.title')}</h1>
        <p aria-live="polite" className="text-text-muted text-sm">
          {isPending
            ? t('store.inventory.loading')
            : data
              ? t('store.inventory.summary', { count: data.pagination.total })
              : ''}
        </p>
      </header>

      <SearchBar
        defaultValue={searchParam}
        placeholder={t('store.inventory.searchPlaceholder')}
        label={t('store.inventory.searchLabel')}
        onSearch={(term) => {
          setSearch(term);
          setParam({ page: undefined });
        }}
      />

      <div role="radiogroup" aria-label={t('store.inventory.statusLabel')} className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const active = tab.value === statusParam;

          return (
            <button
              key={tab.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setParam({ status: tab.value })}
              className={cn(
                'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline-variant bg-surface text-text hover:bg-surface-muted',
              )}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" label={t('store.inventory.loadingLevels')} />
          ))}
        </div>
      ) : null}

      {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {data?.items.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-7" aria-hidden="true" />}
          title={
            statusParam === 'LOW_STOCK'
              ? t('store.inventory.emptyLow')
              : statusParam === 'OUT_OF_STOCK'
                ? t('store.inventory.emptyOut')
                : t('store.inventory.emptyDefault')
          }
          description={
            search
              ? tx('store.inventory.emptyForTerm', { term: <bdi>{search}</bdi> })
              : t('store.inventory.emptyTryFilter')
          }
          className="bg-surface-muted rounded-lg"
        />
      ) : null}

      {data && data.items.length > 0 ? (
        <ul className="flex list-none flex-col gap-2">
          {data.items.map((row) => (
            <StockRow key={row.id} row={row} onShowHistory={() => setHistoryFor(row)} />
          ))}
        </ul>
      ) : null}

      {data && data.pagination.totalPages > 1 ? (
        <nav aria-label={t('store.inventory.pagesLabel')} className="gap-gutter flex items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setParam({ page: String(page - 1) })}
          >
            {t('common.previous')}
          </Button>
          <span aria-live="polite" className="text-text-muted text-sm">
            {t('common.page', { page: data.pagination.page, pages: data.pagination.totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pagination.totalPages}
            onClick={() => setParam({ page: String(page + 1) })}
          >
            {t('common.next')}
          </Button>
        </nav>
      ) : null}

      <StockHistoryDialog row={historyFor} onClose={() => setHistoryFor(null)} />
    </Container>
  );
}

/**
 * One stock row.
 *
 * Two ways to change the number, because they mean different things: quick
 * relative buttons for the common case (a delivery arrived, one was damaged), and
 * an absolute set for a stock take. The server applies the relative form with the
 * guard in the query, so two people adjusting at once cannot both win.
 */
function StockRow({ row, onShowHistory }: { row: StoreInventoryRow; onShowHistory: () => void }) {
  const { t } = useI18n();
  const [isEditing, setEditing] = useState(false);
  const update = useUpdateStock(() => setEditing(false));

  return (
    <li className="border-outline-variant bg-surface p-gutter gap-gutter flex flex-wrap items-center rounded-lg border">
      <div className="flex min-w-48 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-text text-sm font-semibold">
            <bdi>{row.productName}</bdi>
          </h2>
          {!row.isProductActive ? (
            <span className="bg-surface-sunken text-text-muted rounded-full px-2 py-0.5 text-xs font-semibold">
              {t('store.inventory.offSale')}
            </span>
          ) : null}
        </div>

        <p className="text-text-muted text-xs">
          <Ltr>{row.sku}</Ltr>
        </p>

        <p className={cn('text-xs font-semibold', STATUS_STYLE[row.status])}>
          {t('store.inventory.rowSummary', {
            status: t(('store.stock.' + row.status) as TranslationKey),
            count: row.quantity,
            threshold: row.lowStockThreshold,
          })}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={row.quantity <= 0 || update.isPending}
          onClick={() =>
            update.mutate({ productId: row.productId, adjustBy: -1, changeReason: 'CORRECTION' })
          }
          aria-label={t('store.inventory.removeOne', { name: row.productName })}
        >
          −1
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={update.isPending}
          onClick={() =>
            update.mutate({ productId: row.productId, adjustBy: 10, changeReason: 'RESTOCK' })
          }
          aria-label={t('store.inventory.addTen', { name: row.productName })}
        >
          +10
        </Button>

        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          {t('store.inventory.setStock')}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onShowHistory}
          aria-label={t('store.inventory.historyAria', { name: row.productName })}
        >
          <History className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <SetStockDialog open={isEditing} row={row} onClose={() => setEditing(false)} />
    </li>
  );
}

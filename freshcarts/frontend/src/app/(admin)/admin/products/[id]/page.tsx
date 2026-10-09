'use client';

import { useParams, useRouter } from 'next/navigation';
import { ProductForm } from '@/components/admin/product-form';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { AvailabilityBadge } from '@/components/product/badges';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminCategories, useAdminProduct } from '@/features/admin/admin.hooks';
import { useI18n } from '@/i18n';
import { useProductSubmit } from '@/features/admin/use-product-submit';

export default function Page() {
  const { t, tx } = useI18n();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const product = useAdminProduct(id);
  const { data: categories = [] } = useAdminCategories();

  // Same path as creation: an edit may also introduce a new category.
  const { submit, isSubmitting } = useProductSubmit({
    productId: id,
    onDone: () => router.push('/admin/products'),
  });

  return (
    <Container className="gap-loose flex max-w-2xl flex-col">
      <header className="gap-gutter flex flex-wrap items-center justify-between">
        <h1 className="text-text text-xl font-semibold">
          {product.data
            ? tx('admin.products.editTitle', { name: <bdi>{product.data.name}</bdi> })
            : t('admin.products.editFallback')}
        </h1>

        {product.data ? (
          <div className="gap-gutter flex items-center">
            <AvailabilityBadge stock={product.data.stock} />
            {/* Stock is deliberately not editable here — one screen owns it. */}
            <ButtonLink href="/admin/inventory" variant="outline" size="sm">
              {t('admin.products.manageStock')}
            </ButtonLink>
          </div>
        ) : null}
      </header>

      {product.isPending ? <Skeleton className="h-96 w-full" label={t('admin.products.loadingProduct')} /> : null}

      {product.isError ? (
        <ErrorState error={product.error} onRetry={() => void product.refetch()} />
      ) : null}

      {product.data ? (
        <ProductForm
          product={product.data}
          categories={categories}
          isSubmitting={isSubmitting}
          onCancel={() => router.push('/admin/products')}
          onSubmit={(values) => void submit(values)}
        />
      ) : null}
    </Container>
  );
}

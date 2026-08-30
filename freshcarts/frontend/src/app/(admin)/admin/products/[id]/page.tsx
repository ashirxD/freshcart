'use client';

import { useParams, useRouter } from 'next/navigation';
import { ProductForm } from '@/components/admin/product-form';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { AvailabilityBadge } from '@/components/product/badges';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAdminCategories,
  useAdminProduct,
  useUpdateProduct,
} from '@/features/admin/admin.hooks';
import { toProductInput } from '@/lib/validation/catalog.schema';

export default function Page() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const product = useAdminProduct(id);
  const { data: categories = [] } = useAdminCategories();
  const update = useUpdateProduct(id, () => router.push('/admin/products'));

  return (
    <Container className="gap-lg flex max-w-2xl flex-col">
      <header className="gap-gutter flex flex-wrap items-center justify-between">
        <h1 className="text-text text-xl font-semibold">
          {product.data ? 'Edit ' + product.data.name : 'Edit product'}
        </h1>

        {product.data ? (
          <div className="gap-gutter flex items-center">
            <AvailabilityBadge stock={product.data.stock} />
            {/* Stock is deliberately not editable here — one screen owns it. */}
            <ButtonLink href="/admin/inventory" variant="outline" size="sm">
              Manage stock
            </ButtonLink>
          </div>
        ) : null}
      </header>

      {product.isPending ? <Skeleton className="h-96 w-full" label="Loading the product" /> : null}

      {product.isError ? (
        <ErrorState error={product.error} onRetry={() => void product.refetch()} />
      ) : null}

      {product.data ? (
        <ProductForm
          product={product.data}
          categories={categories}
          isSubmitting={update.isPending}
          onCancel={() => router.push('/admin/products')}
          onSubmit={(values) =>
            update.mutate(toProductInput(values, { includeOpeningStock: false }))
          }
        />
      ) : null}
    </Container>
  );
}

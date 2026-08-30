'use client';

import { useRouter } from 'next/navigation';
import { ProductForm } from '@/components/admin/product-form';
import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminCategories, useCreateProduct } from '@/features/admin/admin.hooks';
import { toProductInput } from '@/lib/validation/catalog.schema';

export default function Page() {
  const router = useRouter();
  const { data: categories = [], isPending } = useAdminCategories();
  const create = useCreateProduct(() => router.push('/admin/products'));

  return (
    <Container className="gap-lg flex max-w-2xl flex-col">
      <h1 className="text-text text-xl font-semibold">New product</h1>

      {isPending ? (
        <Skeleton className="h-96 w-full" label="Loading the form" />
      ) : (
        <ProductForm
          categories={categories}
          isSubmitting={create.isPending}
          onCancel={() => router.push('/admin/products')}
          onSubmit={(values) =>
            create.mutate(toProductInput(values, { includeOpeningStock: true }))
          }
        />
      )}
    </Container>
  );
}

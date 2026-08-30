'use client';

import { useParams, useRouter } from 'next/navigation';
import { CategoryForm } from '@/components/admin/category-form';
import { ErrorState } from '@/components/common/error-state';
import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAdminCategories,
  useAdminCategory,
  useUpdateCategory,
} from '@/features/admin/admin.hooks';
import { toCategoryInput } from '@/lib/validation/catalog.schema';

export default function Page() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const category = useAdminCategory(id);
  const { data: categories = [] } = useAdminCategories();
  const update = useUpdateCategory(id, () => router.push('/admin/categories'));

  return (
    <Container className="gap-lg flex max-w-2xl flex-col">
      <h1 className="text-text text-xl font-semibold">
        {category.data ? 'Edit ' + category.data.name : 'Edit category'}
      </h1>

      {category.isPending ? (
        <Skeleton className="h-96 w-full" label="Loading the category" />
      ) : null}

      {category.isError ? (
        <ErrorState error={category.error} onRetry={() => void category.refetch()} />
      ) : null}

      {category.data ? (
        <CategoryForm
          category={category.data}
          parentOptions={categories}
          isSubmitting={update.isPending}
          onCancel={() => router.push('/admin/categories')}
          onSubmit={(values) => update.mutate(toCategoryInput(values))}
        />
      ) : null}
    </Container>
  );
}

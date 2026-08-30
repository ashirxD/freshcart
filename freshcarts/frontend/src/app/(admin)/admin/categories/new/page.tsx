'use client';

import { useRouter } from 'next/navigation';
import { CategoryForm } from '@/components/admin/category-form';
import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminCategories, useCreateCategory } from '@/features/admin/admin.hooks';
import { toCategoryInput } from '@/lib/validation/catalog.schema';

export default function Page() {
  const router = useRouter();
  const { data: categories = [], isPending } = useAdminCategories();
  const create = useCreateCategory(() => router.push('/admin/categories'));

  return (
    <Container className="gap-lg flex max-w-2xl flex-col">
      <h1 className="text-text text-xl font-semibold">New category</h1>

      {isPending ? (
        <Skeleton className="h-96 w-full" label="Loading the form" />
      ) : (
        <CategoryForm
          parentOptions={categories}
          isSubmitting={create.isPending}
          onCancel={() => router.push('/admin/categories')}
          onSubmit={(values) => create.mutate(toCategoryInput(values))}
        />
      )}
    </Container>
  );
}

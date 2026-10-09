'use client';

import { useRouter } from 'next/navigation';
import { CategoryForm } from '@/components/admin/category-form';
import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminCategories, useCreateCategory } from '@/features/admin/admin.hooks';
import { useT } from '@/i18n';
import { toCategoryInput } from '@/lib/validation/catalog.schema';

export default function Page() {
  const t = useT();
  const router = useRouter();
  const { data: categories = [], isPending } = useAdminCategories();
  const create = useCreateCategory(() => router.push('/admin/categories'));

  return (
    <Container className="gap-loose flex max-w-2xl flex-col">
      <h1 className="text-text text-xl font-semibold">{t('admin.categories.newTitle')}</h1>

      {isPending ? (
        <Skeleton className="h-96 w-full" label={t('admin.products.loadingForm')} />
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

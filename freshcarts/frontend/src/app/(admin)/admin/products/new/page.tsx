'use client';

import { useRouter } from 'next/navigation';
import { ProductForm } from '@/components/admin/product-form';
import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminCategories } from '@/features/admin/admin.hooks';
import { useT } from '@/i18n';
import { useProductSubmit } from '@/features/admin/use-product-submit';

export default function Page() {
  const t = useT();
  const router = useRouter();
  const { data: categories = [], isPending } = useAdminCategories();

  // Handles the case where the admin typed a category that does not exist yet:
  // it is created first, then the product is created against it.
  const { submit, isSubmitting } = useProductSubmit({
    onDone: () => router.push('/admin/products'),
  });

  return (
    <Container className="gap-loose flex max-w-2xl flex-col">
      <h1 className="text-text text-xl font-semibold">{t('admin.products.newTitle')}</h1>

      {isPending ? (
        <Skeleton className="h-96 w-full" label={t('admin.products.loadingForm')} />
      ) : (
        <ProductForm
          categories={categories}
          isSubmitting={isSubmitting}
          onCancel={() => router.push('/admin/products')}
          onSubmit={(values) => void submit(values)}
        />
      )}
    </Container>
  );
}

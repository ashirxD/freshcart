'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogKeys } from '@/features/catalog/catalog.hooks';
import { ApiError } from '@/lib/api/errors';
import { useToast } from '@/store/toast.store';
import type { ProductQuery } from '@/types/catalog';
import { adminApi, type CategoryInput, type ProductInput } from './admin.api';

export const adminKeys = {
  all: ['admin'] as const,
  categories: () => [...adminKeys.all, 'categories'] as const,
  category: (id: string) => [...adminKeys.all, 'category', id] as const,
  products: (query: ProductQuery) => [...adminKeys.all, 'products', query] as const,
  product: (id: string) => [...adminKeys.all, 'product', id] as const,
  inventory: (query: object) => [...adminKeys.all, 'inventory', query] as const,
};

export function useAdminCategories() {
  return useQuery({ queryKey: adminKeys.categories(), queryFn: () => adminApi.categories() });
}

export function useAdminCategory(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.category(id ?? ''),
    queryFn: () => adminApi.category(id as string),
    enabled: Boolean(id),
  });
}

export function useAdminProducts(query: ProductQuery) {
  return useQuery({
    queryKey: adminKeys.products(query),
    queryFn: () => adminApi.products(query),
  });
}

export function useAdminProduct(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.product(id ?? ''),
    queryFn: () => adminApi.product(id as string),
    enabled: Boolean(id),
  });
}

export function useAdminInventory(query: {
  page?: number;
  search?: string;
  lowStockOnly?: boolean;
}) {
  return useQuery({
    queryKey: adminKeys.inventory(query),
    queryFn: () => adminApi.inventory({ ...query, limit: 20 }),
  });
}

/**
 * Shared plumbing for every back-office write.
 *
 * A catalogue change is visible to shoppers immediately, so both the admin and
 * the storefront caches are invalidated — otherwise an admin would edit a
 * product and still see the old one on the customer side of the same session.
 */
function useAdminMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  options: { successMessage: string; errorTitle: string; onDone?: (result: TResult) => void },
) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      toast({ title: options.successMessage, variant: 'success' });
      options.onDone?.(result);
    },
    onError: (error: unknown) => {
      toast({
        title: options.errorTitle,
        description:
          error instanceof ApiError ? error.message : 'Please check your connection and try again.',
        variant: 'error',
      });
    },
  });
}

// --- Categories ----------------------------------------------------------

export function useCreateCategory(onDone?: () => void) {
  return useAdminMutation((input: CategoryInput) => adminApi.createCategory(input), {
    successMessage: 'Category created',
    errorTitle: 'Could not create the category',
    onDone,
  });
}

export function useUpdateCategory(id: string, onDone?: () => void) {
  return useAdminMutation((input: Partial<CategoryInput>) => adminApi.updateCategory(id, input), {
    successMessage: 'Category updated',
    errorTitle: 'Could not update the category',
    onDone,
  });
}

export function useSetCategoryStatus() {
  return useAdminMutation(
    ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.setCategoryStatus(id, isActive),
    { successMessage: 'Category status updated', errorTitle: 'Could not change the status' },
  );
}

export function useReorderCategories() {
  return useAdminMutation(
    (categories: Array<{ id: string; displayOrder: number }>) =>
      adminApi.reorderCategories(categories),
    { successMessage: 'Order saved', errorTitle: 'Could not save the new order' },
  );
}

export function useDeleteCategory() {
  return useAdminMutation((id: string) => adminApi.deleteCategory(id), {
    successMessage: 'Category deleted',
    // A category holding products is refused by the API with an explanation,
    // which the toast surfaces verbatim.
    errorTitle: 'Could not delete the category',
  });
}

// --- Products ------------------------------------------------------------

export function useCreateProduct(onDone?: () => void) {
  return useAdminMutation((input: ProductInput) => adminApi.createProduct(input), {
    successMessage: 'Product created',
    errorTitle: 'Could not create the product',
    onDone,
  });
}

export function useUpdateProduct(id: string, onDone?: () => void) {
  return useAdminMutation((input: Partial<ProductInput>) => adminApi.updateProduct(id, input), {
    successMessage: 'Product updated',
    errorTitle: 'Could not update the product',
    onDone,
  });
}

export function useSetProductStatus() {
  return useAdminMutation(
    ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.setProductStatus(id, isActive),
    { successMessage: 'Product status updated', errorTitle: 'Could not change the status' },
  );
}

export function useDeleteProduct() {
  return useAdminMutation((id: string) => adminApi.deleteProduct(id), {
    successMessage: 'Product deleted',
    errorTitle: 'Could not delete the product',
  });
}

// --- Inventory -----------------------------------------------------------

export function useUpdateInventory() {
  return useAdminMutation(
    ({
      productId,
      ...input
    }: {
      productId: string;
      quantity?: number;
      adjustBy?: number;
      lowStockThreshold?: number;
    }) => adminApi.updateInventory(productId, input),
    { successMessage: 'Stock updated', errorTitle: 'Could not update the stock' },
  );
}

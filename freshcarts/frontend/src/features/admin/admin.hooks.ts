'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogKeys } from '@/features/catalog/catalog.hooks';
import { ApiError } from '@/lib/api/errors';
import { useToast } from '@/store/toast.store';
import type {
  AdminOrderQuery,
  CreateStoreManagerInput,
  DeliveryRuleInput,
  PlatformSettingsInput,
  StoreInput,
  UpdateStoreManagerInput,
} from '@/types/admin';
import type { ProductQuery } from '@/types/catalog';
import type { OrderStatus } from '@/types/order';
import { adminApi, type CategoryInput, type ProductInput } from './admin.api';

/**
 * Query keys, all nested under `['admin']`.
 *
 * That nesting is what makes invalidation after a write a single call: every
 * back-office mutation invalidates `adminKeys.all` alongside the storefront's
 * `catalogKeys.all`, because an admin who edits a product must not keep seeing
 * the old one on the customer side of the same session.
 */
export const adminKeys = {
  all: ['admin'] as const,
  dashboard: () => [...adminKeys.all, 'dashboard'] as const,
  categories: () => [...adminKeys.all, 'categories'] as const,
  category: (id: string) => [...adminKeys.all, 'category', id] as const,
  products: (query: ProductQuery) => [...adminKeys.all, 'products', query] as const,
  product: (id: string) => [...adminKeys.all, 'product', id] as const,
  inventory: (query: object) => [...adminKeys.all, 'inventory', query] as const,
  orders: (query: AdminOrderQuery) => [...adminKeys.all, 'orders', query] as const,
  order: (id: string) => [...adminKeys.all, 'order', id] as const,
  customers: (query: object) => [...adminKeys.all, 'customers', query] as const,
  customer: (id: string) => [...adminKeys.all, 'customer', id] as const,
  storeManagers: (query: object) => [...adminKeys.all, 'store-managers', query] as const,
  stores: () => [...adminKeys.all, 'stores'] as const,
  store: (id: string) => [...adminKeys.all, 'store', id] as const,
  deliveryRules: () => [...adminKeys.all, 'delivery-rules'] as const,
  settings: () => [...adminKeys.all, 'settings'] as const,
  auditLogs: (query: object) => [...adminKeys.all, 'audit-logs', query] as const,
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

// --- Dashboard -----------------------------------------------------------

/**
 * The whole control centre in one request.
 *
 * A short stale time rather than none: an operations dashboard gets left open
 * on a second screen, and refetching every count on every window focus would
 * be constant traffic for numbers that move in minutes, not seconds.
 */
export function useAdminDashboard() {
  return useQuery({
    queryKey: adminKeys.dashboard(),
    queryFn: () => adminApi.dashboard(),
    staleTime: 30_000,
  });
}

// --- Orders --------------------------------------------------------------

export function useAdminOrders(query: AdminOrderQuery) {
  return useQuery({
    queryKey: adminKeys.orders(query),
    queryFn: () => adminApi.orders(query),
    // An order queue that is a minute stale is misleading, so this one is
    // never served from cache without a refetch behind it.
    staleTime: 0,
  });
}

export function useAdminOrder(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.order(id ?? ''),
    queryFn: () => adminApi.order(id as string),
    enabled: Boolean(id),
  });
}

export function useOverrideOrderStatus(id: string, onDone?: () => void) {
  return useAdminMutation(
    (input: { status: OrderStatus; reason: string }) => adminApi.overrideOrderStatus(id, input),
    {
      successMessage: 'Order updated',
      // An illegal transition comes back as a sentence naming which one it is,
      // and the toast shows that verbatim rather than inventing its own.
      errorTitle: 'Could not update the order',
      onDone,
    },
  );
}

// --- Customers -----------------------------------------------------------

export function useAdminCustomers(query: { page?: number; search?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: adminKeys.customers(query),
    queryFn: () => adminApi.customers(query),
  });
}

export function useAdminCustomer(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.customer(id ?? ''),
    queryFn: () => adminApi.customer(id as string),
    enabled: Boolean(id),
  });
}

export function useSetCustomerStatus() {
  return useAdminMutation(
    ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.setCustomerStatus(id, isActive),
    { successMessage: 'Customer updated', errorTitle: 'Could not update the customer' },
  );
}

// --- Store managers ------------------------------------------------------

export function useAdminStoreManagers(query: {
  page?: number;
  search?: string;
  isActive?: boolean;
}) {
  return useQuery({
    queryKey: adminKeys.storeManagers(query),
    queryFn: () => adminApi.storeManagers(query),
  });
}

export function useCreateStoreManager(onDone?: () => void) {
  return useAdminMutation((input: CreateStoreManagerInput) => adminApi.createStoreManager(input), {
    successMessage: 'Store manager created',
    errorTitle: 'Could not create the store manager',
    onDone,
  });
}

export function useUpdateStoreManager(onDone?: () => void) {
  return useAdminMutation(
    ({ id, ...input }: UpdateStoreManagerInput & { id: string }) =>
      adminApi.updateStoreManager(id, input),
    {
      successMessage: 'Store manager updated',
      errorTitle: 'Could not update the store manager',
      onDone,
    },
  );
}

export function useSetStoreManagerStatus() {
  return useAdminMutation(
    ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.setStoreManagerStatus(id, isActive),
    { successMessage: 'Store manager updated', errorTitle: 'Could not update the store manager' },
  );
}

// --- Stores --------------------------------------------------------------

export function useAdminStores() {
  return useQuery({ queryKey: adminKeys.stores(), queryFn: () => adminApi.stores() });
}

export function useAdminStore(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.store(id ?? ''),
    queryFn: () => adminApi.store(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateStore(onDone?: () => void) {
  return useAdminMutation((input: StoreInput) => adminApi.createStore(input), {
    successMessage: 'Store created',
    errorTitle: 'Could not create the store',
    onDone,
  });
}

export function useUpdateStore(id: string, onDone?: () => void) {
  return useAdminMutation((input: Partial<StoreInput>) => adminApi.updateStore(id, input), {
    successMessage: 'Store updated',
    errorTitle: 'Could not update the store',
    onDone,
  });
}

// --- Delivery pricing ----------------------------------------------------

export function useDeliveryRules() {
  return useQuery({
    queryKey: adminKeys.deliveryRules(),
    queryFn: () => adminApi.deliveryRules(),
  });
}

export function useCreateDeliveryRule(onDone?: () => void) {
  return useAdminMutation((input: DeliveryRuleInput) => adminApi.createDeliveryRule(input), {
    successMessage: 'Pricing rule added',
    // An overlap or an inverted range comes back naming the clashing band.
    errorTitle: 'Could not add the pricing rule',
    onDone,
  });
}

export function useUpdateDeliveryRule(onDone?: () => void) {
  return useAdminMutation(
    ({ id, ...input }: Partial<DeliveryRuleInput> & { id: string }) =>
      adminApi.updateDeliveryRule(id, input),
    {
      successMessage: 'Pricing rule updated',
      errorTitle: 'Could not update the pricing rule',
      onDone,
    },
  );
}

export function useDeleteDeliveryRule() {
  return useAdminMutation((id: string) => adminApi.deleteDeliveryRule(id), {
    successMessage: 'Pricing rule deleted',
    errorTitle: 'Could not delete the pricing rule',
  });
}

// --- Settings and audit --------------------------------------------------

export function useAdminSettings() {
  return useQuery({ queryKey: adminKeys.settings(), queryFn: () => adminApi.settings() });
}

export function useUpdateSettings(onDone?: () => void) {
  return useAdminMutation((input: PlatformSettingsInput) => adminApi.updateSettings(input), {
    successMessage: 'Settings saved',
    errorTitle: 'Could not save the settings',
    onDone,
  });
}

export function useAuditLogs(query: { page?: number; action?: string; entityType?: string }) {
  return useQuery({
    queryKey: adminKeys.auditLogs(query),
    queryFn: () => adminApi.auditLogs(query),
  });
}

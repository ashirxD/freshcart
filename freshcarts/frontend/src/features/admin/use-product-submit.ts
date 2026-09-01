'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/features/admin/admin.api';
import { adminKeys } from '@/features/admin/admin.hooks';
import { catalogKeys } from '@/features/catalog/catalog.hooks';
import { ApiError } from '@/lib/api/errors';
import { useToast } from '@/store/toast.store';
import { toProductInput, type ProductFormValues } from '@/lib/validation/catalog.schema';
import type { ProductInput } from '@/features/admin/admin.api';

/**
 * SAVING A PRODUCT THAT INTRODUCES A NEW CATEGORY
 * ===============================================
 *
 * The admin can type a category or subcategory that does not exist yet. Those
 * have to become real records before the product can reference them, so a save
 * is up to three requests: create the category, create the subcategory beneath
 * it, then create the product.
 *
 * ORDER MATTERS AND IS NOT NEGOTIABLE. The subcategory needs its parent's id,
 * and the product needs both. Running them concurrently would mean guessing an
 * id that does not exist yet.
 *
 * WHAT HAPPENS ON A PARTIAL FAILURE, stated honestly: if the category is
 * created and the product then fails validation, the category remains. That is
 * a deliberate trade rather than an oversight — the alternative is a
 * compensating delete that could itself fail, or a bespoke transactional
 * endpoint for a case that is rare and harmless. An extra empty category is
 * visible at /admin/categories and takes one click to remove; a half-written
 * product would be far worse. The toast says so when it happens.
 *
 * Categories are created ACTIVE, which is what makes them appear to shoppers
 * straight away — that is the behaviour being asked for, and it is why the
 * combobox warns before the save rather than after.
 */
export function useProductSubmit(options: {
  /** Absent when creating. */
  productId?: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isSubmitting, setSubmitting] = useState(false);

  const submit = async (values: ProductFormValues) => {
    setSubmitting(true);

    // Tracked so the failure message can say what was already created, rather
    // than leaving the admin to discover it themselves.
    const createdCategories: string[] = [];

    try {
      let categoryId = values.categoryId;

      if (!categoryId && values.categoryCreateName.trim()) {
        const created = await adminApi.createCategory({
          name: values.categoryCreateName.trim(),
          isActive: true,
        });
        categoryId = created.id;
        createdCategories.push(created.name);
      }

      let subcategoryId: string | null = values.subcategoryId || null;

      if (!subcategoryId && values.subcategoryCreateName.trim()) {
        const created = await adminApi.createCategory({
          name: values.subcategoryCreateName.trim(),
          // Nested under the category chosen above, which by now definitely
          // has an id whether it existed a moment ago or not.
          parentId: categoryId,
          isActive: true,
        });
        subcategoryId = created.id;
        createdCategories.push(created.name);
      }

      const payload: ProductInput = toProductInput(values, {
        includeOpeningStock: !options.productId,
        categoryId,
        subcategoryId,
      });

      if (options.productId) await adminApi.updateProduct(options.productId, payload);
      else await adminApi.createProduct(payload);

      // A catalogue change is visible to shoppers immediately, so both caches
      // go — otherwise an admin edits a product and still sees the old one on
      // the customer side of the same session.
      await queryClient.invalidateQueries({ queryKey: adminKeys.all });
      await queryClient.invalidateQueries({ queryKey: catalogKeys.all });

      toast({
        title: options.productId ? 'Product updated' : 'Product created',
        description:
          createdCategories.length > 0
            ? 'Added ' + createdCategories.join(' and ') + ' to the categories shoppers see.'
            : undefined,
        variant: 'success',
      });

      options.onDone();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Please check your connection and try again.';

      toast({
        title: options.productId ? 'Could not save the product' : 'Could not create the product',
        description:
          createdCategories.length > 0
            ? message + ' Note: ' + createdCategories.join(' and ') + ' was already created.'
            : message,
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return { submit, isSubmitting };
}

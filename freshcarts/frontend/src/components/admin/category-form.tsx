'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CATEGORY_ICON_NAMES } from '@/components/category/category-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { categoryFormSchema, type CategoryFormValues } from '@/lib/validation/catalog.schema';
import type { Category } from '@/types/catalog';
import { CheckboxField, FormSection, SelectField, TextareaField } from './form-field';

export interface CategoryFormProps {
  /** Absent when creating. */
  category?: Category;
  /** Top-level categories only — the tree is one level deep. */
  parentOptions: Category[];
  onSubmit: (values: CategoryFormValues) => void;
  isSubmitting: boolean;
  onCancel: () => void;
}

/**
 * Create/edit form for a category.
 *
 * There is no slug field: the server derives it from the name and guarantees
 * uniqueness, so letting an admin type one would offer control the backend
 * would legitimately override.
 */
export function CategoryForm({
  category,
  parentOptions,
  onSubmit,
  isSubmitting,
  onCancel,
}: CategoryFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name ?? '',
      description: category?.description ?? '',
      icon: category?.icon ?? '',
      imageUrl: category?.imageUrl ?? '',
      parentId: category?.parentId ?? '',
      displayOrder: category?.displayOrder ?? 0,
      isActive: category?.isActive ?? true,
    },
  });

  const isActive = watch('isActive');

  // A category that already has children cannot itself become a child — the
  // server enforces this, and hiding the option avoids an avoidable rejection.
  const hasChildren = (category?.children.length ?? 0) > 0;

  const options = parentOptions
    .filter((option) => option.id !== category?.id)
    .map((option) => ({ value: option.id, label: option.name }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="gap-gutter flex flex-col">
      <FormSection title="Basics" description="How this category appears to shoppers.">
        <Input
          label="Name"
          placeholder="e.g. Dairy & Eggs"
          error={errors.name?.message}
          {...register('name')}
        />

        <TextareaField
          label="Description"
          hint="Optional. One or two lines shown at the top of the category page."
          error={errors.description?.message}
          {...register('description')}
        />

        {hasChildren ? (
          <p className="bg-surface-muted p-tight text-text-muted rounded-md text-sm">
            This category has {category?.children.length} subcategories, so it stays at the top
            level.
          </p>
        ) : (
          <SelectField
            label="Parent category"
            placeholder="None — this is a top-level category"
            hint="Categories nest one level deep."
            options={options}
            error={errors.parentId?.message}
            {...register('parentId')}
          />
        )}
      </FormSection>

      <FormSection title="Appearance" description="Shown on the category tile.">
        <SelectField
          label="Icon"
          placeholder="Default basket"
          hint="Shown on the category tile when there is no image."
          options={CATEGORY_ICON_NAMES.map((name) => ({ value: name, label: name }))}
          error={errors.icon?.message}
          {...register('icon')}
        />

        <Input
          label="Image URL"
          hint="Optional. Used instead of the icon once image hosting is configured."
          placeholder="https://…"
          error={errors.imageUrl?.message}
          {...register('imageUrl')}
        />
      </FormSection>

      <FormSection
        title="Placement"
        description="Lower numbers appear first in the customer catalogue."
      >
        <Input
          label="Display order"
          type="number"
          inputMode="numeric"
          min={0}
          error={errors.displayOrder?.message}
          {...register('displayOrder', { valueAsNumber: true })}
        />

        <CheckboxField
          label="Visible to customers"
          hint="Turning this off hides the category and all of its subcategories."
          checked={isActive}
          onChange={(checked) => setValue('isActive', checked, { shouldDirty: true })}
        />
      </FormSection>

      <div className="gap-gutter flex flex-wrap">
        <Button type="submit" isLoading={isSubmitting}>
          {category ? 'Save changes' : 'Create category'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

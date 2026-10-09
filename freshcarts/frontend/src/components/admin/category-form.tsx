'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CATEGORY_ICON_NAMES } from '@/components/category/category-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
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
  const { t } = useI18n();
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
      <FormSection
        title={t('admin.categoryForm.basicsTitle')}
        description={t('admin.categoryForm.basicsDesc')}
      >
        <Input
          label={t('admin.categoryForm.name')}
          placeholder={t('admin.categoryForm.namePlaceholder')}
          error={errors.name?.message}
          {...register('name')}
        />

        <TextareaField
          label={t('admin.categoryForm.description')}
          hint={t('admin.categoryForm.descriptionHint')}
          error={errors.description?.message}
          {...register('description')}
        />

        {hasChildren ? (
          <p className="bg-surface-muted p-tight text-text-muted rounded-md text-sm">
            {t('admin.categoryForm.hasChildren', { count: category?.children.length ?? 0 })}
          </p>
        ) : (
          <SelectField
            label={t('admin.categoryForm.parent')}
            placeholder={t('admin.categoryForm.parentPlaceholder')}
            hint={t('admin.categoryForm.parentHint')}
            options={options}
            error={errors.parentId?.message}
            {...register('parentId')}
          />
        )}
      </FormSection>

      <FormSection
        title={t('admin.categoryForm.appearanceTitle')}
        description={t('admin.categoryForm.appearanceDesc')}
      >
        <SelectField
          label={t('admin.categoryForm.icon')}
          placeholder={t('admin.categoryForm.iconPlaceholder')}
          hint={t('admin.categoryForm.iconHint')}
          options={CATEGORY_ICON_NAMES.map((name) => ({ value: name, label: name }))}
          error={errors.icon?.message}
          {...register('icon')}
        />

        <Input
          label={t('admin.categoryForm.imageUrl')}
          hint={t('admin.categoryForm.imageUrlHint')}
          placeholder="https://…"
          ltr
          error={errors.imageUrl?.message}
          {...register('imageUrl')}
        />
      </FormSection>

      <FormSection
        title={t('admin.categoryForm.placementTitle')}
        description={t('admin.categoryForm.placementDesc')}
      >
        <Input
          label={t('admin.categoryForm.displayOrder')}
          type="number"
          inputMode="numeric"
          min={0}
          error={errors.displayOrder?.message}
          {...register('displayOrder', { valueAsNumber: true })}
        />

        <CheckboxField
          label={t('admin.categoryForm.visible')}
          hint={t('admin.categoryForm.visibleHint')}
          checked={isActive}
          onChange={(checked) => setValue('isActive', checked, { shouldDirty: true })}
        />
      </FormSection>

      <div className="gap-gutter flex flex-wrap">
        <Button type="submit" isLoading={isSubmitting}>
          {category ? t('admin.categoryForm.save') : t('admin.categoryForm.create')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

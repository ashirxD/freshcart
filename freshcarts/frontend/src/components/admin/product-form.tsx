'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n, type TranslationKey } from '@/i18n';
import {
  UNIT_TYPES,
  productFormSchema,
  type ProductFormValues,
} from '@/lib/validation/catalog.schema';
import type { Category, ProductDetail } from '@/types/catalog';
import { CategoryCombobox } from './category-combobox';
import { ImageUploader } from './image-uploader';
import { CheckboxField, FormSection, SelectField, TextareaField } from './form-field';

export interface ProductFormProps {
  /** Absent when creating. */
  product?: ProductDetail;
  /** The full active tree; subcategory options come from the chosen parent. */
  categories: Category[];
  onSubmit: (values: ProductFormValues) => void;
  isSubmitting: boolean;
  onCancel: () => void;
}

/**
 * Create/edit form for a product.
 *
 * Opening stock appears only when creating. After that, quantity is owned by
 * the inventory screen, so there is exactly one place that writes a stock level
 * and one place its rules live.
 */
export function ProductForm({
  product,
  categories,
  onSubmit,
  isSubmitting,
  onCancel,
}: ProductFormProps) {
  const { t, tm } = useI18n();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name ?? '',
      brand: product?.brand ?? '',
      shortDescription: product?.shortDescription ?? '',
      description: product?.description ?? '',
      categoryId: product?.categoryId ?? '',
      categoryCreateName: '',
      subcategoryId: product?.subcategoryId ?? '',
      subcategoryCreateName: '',
      images: product?.images ?? [],
      sellingPrice: product?.sellingPrice ?? Number.NaN,
      compareAtPrice: product?.compareAtPrice ? String(product.compareAtPrice) : '',
      unitType: product?.unitType ?? 'PIECE',
      unitValue: product?.unitValue ?? 1,
      sku: product?.sku ?? '',
      barcode: product?.barcode ?? '',
      searchTerms: product?.searchTerms.join(', ') ?? '',
      isActive: product?.isActive ?? true,
      isFeatured: product?.isFeatured ?? false,
      initialQuantity: 0,
      lowStockThreshold: 5,
    },
  });

  const categoryId = watch('categoryId');
  const categoryCreateName = watch('categoryCreateName');
  const subcategoryId = watch('subcategoryId');
  const subcategoryCreateName = watch('subcategoryCreateName');
  const images = watch('images');
  const isActive = watch('isActive');
  const isFeatured = watch('isFeatured');

  // A category that does not exist yet has no children to offer. Creating the
  // parent and a child in one save is supported; picking an existing child of
  // a category that is itself unsaved is not a coherent thing to ask for.
  const subcategories = categoryId
    ? (categories.find((category) => category.id === categoryId)?.children ?? [])
    : [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="gap-gutter flex flex-col">
      <FormSection title={t('admin.productForm.productTitle')} description={t('admin.productForm.productDesc')}>
        <Input
          label={t('admin.productForm.name')}
          placeholder={t('admin.productForm.namePlaceholder')}
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label={t('admin.productForm.brand')}
          hint={t('admin.productForm.brandHint')}
          error={errors.brand?.message}
          {...register('brand')}
        />

        <Input
          label={t('admin.productForm.shortDescription')}
          hint={t('admin.productForm.shortDescriptionHint')}
          error={errors.shortDescription?.message}
          {...register('shortDescription')}
        />

        <TextareaField
          label={t('admin.productForm.fullDescription')}
          error={errors.description?.message}
          {...register('description')}
        />
      </FormSection>

      <FormSection
        title={t('admin.productForm.placementTitle')}
        description={t('admin.productForm.placementDesc')}
      >
        <CategoryCombobox
          label={t('admin.productForm.category')}
          placeholder={t('admin.productForm.categoryPlaceholder')}
          options={categories.map((category) => ({ id: category.id, name: category.name }))}
          error={errors.categoryId?.message}
          value={categoryId ? { id: categoryId } : { createName: categoryCreateName }}
          onChange={(next) => {
            setValue('categoryId', next.id ?? '', { shouldDirty: true });
            setValue('categoryCreateName', next.createName ?? '', { shouldDirty: true });
            // Changing the parent invalidates the child, so it is cleared
            // rather than left pointing at a subcategory of another category.
            setValue('subcategoryId', '');
            setValue('subcategoryCreateName', '');
          }}
        />

        <CategoryCombobox
          label={t('admin.productForm.subcategory')}
          hint={t('admin.productForm.subcategoryHint')}
          placeholder={
            categoryId || categoryCreateName
              ? t('admin.productForm.subcategoryPlaceholder')
              : t('admin.productForm.subcategoryChooseFirst')
          }
          emptyHint={
            categoryCreateName
              ? t('admin.productForm.subcategoryEmptyNew')
              : t('admin.productForm.subcategoryEmptyNone')
          }
          disabled={!categoryId && !categoryCreateName}
          options={subcategories.map((subcategory) => ({
            id: subcategory.id,
            name: subcategory.name,
          }))}
          error={errors.subcategoryId?.message}
          value={subcategoryId ? { id: subcategoryId } : { createName: subcategoryCreateName }}
          onChange={(next) => {
            setValue('subcategoryId', next.id ?? '', { shouldDirty: true });
            setValue('subcategoryCreateName', next.createName ?? '', { shouldDirty: true });
          }}
        />
      </FormSection>

      <FormSection
        title={t('admin.productForm.photosTitle')}
        description={t('admin.productForm.photosDesc')}
      >
        <ImageUploader
          images={images}
          onChange={(next) => setValue('images', next, { shouldDirty: true, shouldValidate: true })}
        />

        {errors.images?.message ? (
          <p role="alert" className="text-danger text-sm">
            {tm(errors.images.message)}
          </p>
        ) : null}

        {/* Per-image alt-text errors: zod reports them by index, and the
            uploader renders the fields, so the summary lives here. */}
        {Array.isArray(errors.images) && errors.images.some(Boolean) ? (
          <p role="alert" className="text-danger text-sm">
            {t('admin.productForm.photoNeedsDescription')}
          </p>
        ) : null}
      </FormSection>

      <FormSection title={t('admin.productForm.priceTitle')} description={t('admin.productForm.priceDesc')}>
        <Input
          label={t('admin.productForm.sellingPrice')}
          type="number"
          inputMode="numeric"
          min={1}
          error={errors.sellingPrice?.message}
          {...register('sellingPrice', { valueAsNumber: true })}
        />

        <Input
          label={t('admin.productForm.wasPrice')}
          hint={t('admin.productForm.wasPriceHint')}
          type="number"
          inputMode="numeric"
          min={1}
          error={errors.compareAtPrice?.message}
          {...register('compareAtPrice')}
        />
      </FormSection>

      <FormSection title={t('admin.productForm.packTitle')} description={t('admin.productForm.packDesc')}>
        <SelectField
          label={t('admin.productForm.unit')}
          options={UNIT_TYPES.map((unit) => ({
            value: unit.value,
            label: t(('admin.unit.' + unit.value) as TranslationKey),
          }))}
          error={errors.unitType?.message}
          {...register('unitType')}
        />

        <Input
          label={t('admin.productForm.size')}
          hint={t('admin.productForm.sizeHint')}
          type="number"
          inputMode="decimal"
          step="any"
          min={0.001}
          error={errors.unitValue?.message}
          {...register('unitValue', { valueAsNumber: true })}
        />
      </FormSection>

      <FormSection
        title={t('admin.productForm.identifiersTitle')}
        description={t('admin.productForm.identifiersDesc')}
      >
        <Input
          label={t('admin.productForm.sku')}
          hint={t('admin.productForm.skuHint')}
          placeholder={t('admin.productForm.skuPlaceholder')}
          ltr
          error={errors.sku?.message}
          {...register('sku')}
        />

        <Input
          label={t('admin.productForm.barcode')}
          hint={t('admin.productForm.barcodeHint')}
          inputMode="numeric"
          error={errors.barcode?.message}
          {...register('barcode')}
        />

        <Input
          label={t('admin.productForm.alsoFindable')}
          hint={t('admin.productForm.alsoFindableHint')}
          placeholder={t('admin.productForm.alsoFindablePlaceholder')}
          error={errors.searchTerms?.message}
          {...register('searchTerms')}
        />
      </FormSection>

      {!product ? (
        <FormSection
          title={t('admin.productForm.openingStockTitle')}
          description={t('admin.productForm.openingStockDesc')}
        >
          <Input
            label={t('admin.productForm.quantityOnHand')}
            type="number"
            inputMode="numeric"
            min={0}
            error={errors.initialQuantity?.message}
            {...register('initialQuantity', { valueAsNumber: true })}
          />

          <Input
            label={t('admin.productForm.lowStockAt')}
            hint={t('admin.productForm.lowStockAtHint')}
            type="number"
            inputMode="numeric"
            min={0}
            error={errors.lowStockThreshold?.message}
            {...register('lowStockThreshold', { valueAsNumber: true })}
          />
        </FormSection>
      ) : null}

      <FormSection title={t('admin.productForm.visibilityTitle')}>
        <CheckboxField
          label={t('admin.productForm.available')}
          hint={t('admin.productForm.availableHint')}
          checked={isActive}
          onChange={(checked) => setValue('isActive', checked, { shouldDirty: true })}
        />

        <CheckboxField
          label={t('admin.productForm.feature')}
          checked={isFeatured}
          onChange={(checked) => setValue('isFeatured', checked, { shouldDirty: true })}
        />
      </FormSection>

      <div className="gap-gutter flex flex-wrap">
        <Button type="submit" isLoading={isSubmitting}>
          {product ? t('admin.productForm.save') : t('admin.productForm.create')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

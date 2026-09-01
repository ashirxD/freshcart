'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
      <FormSection title="Product" description="What a shopper sees on the card and page.">
        <Input
          label="Name"
          placeholder="e.g. Olper's Full Cream Milk"
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="Brand"
          hint="Optional — leave blank for unbranded items like loose vegetables."
          error={errors.brand?.message}
          {...register('brand')}
        />

        <Input
          label="Short description"
          hint="One line, shown on the product card."
          error={errors.shortDescription?.message}
          {...register('shortDescription')}
        />

        <TextareaField
          label="Full description"
          error={errors.description?.message}
          {...register('description')}
        />
      </FormSection>

      <FormSection
        title="Placement"
        description="Where this product is found in the store. Type a new name to add a category."
      >
        <CategoryCombobox
          label="Category"
          placeholder="Search, or type a new category"
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
          label="Subcategory"
          hint="Optional, but it makes the product much easier to find."
          placeholder={
            categoryId || categoryCreateName
              ? 'Search, or type a new one'
              : 'Choose a category first'
          }
          emptyHint={
            categoryCreateName
              ? 'This category is new, so it has no subcategories yet — type one to create it too.'
              : 'This category has no subcategories yet. Type a name to create one.'
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
        title="Photos"
        description="The first photo is what shoppers see on the product card."
      >
        <ImageUploader
          images={images}
          onChange={(next) => setValue('images', next, { shouldDirty: true, shouldValidate: true })}
        />

        {errors.images?.message ? (
          <p role="alert" className="text-danger text-sm">
            {errors.images.message}
          </p>
        ) : null}

        {/* Per-image alt-text errors: zod reports them by index, and the
            uploader renders the fields, so the summary lives here. */}
        {Array.isArray(errors.images) && errors.images.some(Boolean) ? (
          <p role="alert" className="text-danger text-sm">
            Every photo needs a short description.
          </p>
        ) : null}
      </FormSection>

      <FormSection title="Price" description="Whole rupees. There is no paisa in this catalogue.">
        <Input
          label="Selling price (Rs.)"
          type="number"
          inputMode="numeric"
          min={1}
          error={errors.sellingPrice?.message}
          {...register('sellingPrice', { valueAsNumber: true })}
        />

        <Input
          label="Was price (Rs.)"
          hint="Optional. Shown struck through — leave blank when there is no discount."
          type="number"
          inputMode="numeric"
          min={1}
          error={errors.compareAtPrice?.message}
          {...register('compareAtPrice')}
        />
      </FormSection>

      <FormSection title="Pack size" description="How the product is sold.">
        <SelectField
          label="Unit"
          options={UNIT_TYPES.map((unit) => ({ value: unit.value, label: unit.label }))}
          error={errors.unitType?.message}
          {...register('unitType')}
        />

        <Input
          label="Size"
          hint="1 for a 1 L bottle, 500 for a 500 g pack, 5 for a 5 kg bag."
          type="number"
          inputMode="decimal"
          step="any"
          min={0.001}
          error={errors.unitValue?.message}
          {...register('unitValue', { valueAsNumber: true })}
        />
      </FormSection>

      <FormSection title="Identifiers" description="Used by staff and, later, by scanning.">
        <Input
          label="Item code (SKU)"
          hint="Unique within this store. Letters, digits and hyphens."
          placeholder="FC-DAI-001"
          error={errors.sku?.message}
          {...register('sku')}
        />

        <Input
          label="Barcode"
          hint="Optional — many local products do not have one."
          inputMode="numeric"
          error={errors.barcode?.message}
          {...register('barcode')}
        />

        <Input
          label="Also findable as"
          hint="Comma separated. Add Urdu and Roman-Urdu names, e.g. doodh, dodh."
          placeholder="doodh, milk"
          error={errors.searchTerms?.message}
          {...register('searchTerms')}
        />
      </FormSection>

      {!product ? (
        <FormSection
          title="Opening stock"
          description="Set once at creation. After that, stock is managed on the Inventory screen."
        >
          <Input
            label="Quantity on hand"
            type="number"
            inputMode="numeric"
            min={0}
            error={errors.initialQuantity?.message}
            {...register('initialQuantity', { valueAsNumber: true })}
          />

          <Input
            label="Low stock warning at"
            hint="The product is flagged as running low at or below this number."
            type="number"
            inputMode="numeric"
            min={0}
            error={errors.lowStockThreshold?.message}
            {...register('lowStockThreshold', { valueAsNumber: true })}
          />
        </FormSection>
      ) : null}

      <FormSection title="Visibility">
        <CheckboxField
          label="Available in the store"
          hint="Turning this off removes the product from the customer catalogue immediately."
          checked={isActive}
          onChange={(checked) => setValue('isActive', checked, { shouldDirty: true })}
        />

        <CheckboxField
          label="Feature on the home page"
          checked={isFeatured}
          onChange={(checked) => setValue('isFeatured', checked, { shouldDirty: true })}
        />
      </FormSection>

      <div className="gap-gutter flex flex-wrap">
        <Button type="submit" isLoading={isSubmitting}>
          {product ? 'Save changes' : 'Create product'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

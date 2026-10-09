import { z } from 'zod';
import type { CategoryInput, ProductInput } from '@/features/admin/admin.api';

/**
 * Form schemas for the back office.
 *
 * These describe the *form*, not the API payload: every field is exactly the
 * type the input element produces, with no `.default()` or `.transform()`. That
 * keeps validation honest about what is on screen, and it keeps the shape a
 * shopper sees identical to the shape React Hook Form manages.
 *
 * Turning a filled-in form into an API request is a separate, explicit step —
 * the `to*Input` mappers at the bottom of this file.
 *
 * All of this is a convenience layer. The server validates every field again
 * and remains the single authority, which is why the rules that need database
 * state — slug uniqueness, SKU collisions, whether a subcategory really belongs
 * to its parent — are deliberately absent rather than half-reimplemented here.
 */

const MAX_PRICE_PKR = 10_000_000;

/** Whole rupees. Prices are integers end to end, so a decimal is a mistake. */
const priceField = z
  .number({ invalid_type_error: 'validation.catalog.priceInvalid' })
  .int('validation.catalog.priceWhole')
  .min(1, 'validation.catalog.priceMin')
  .max(MAX_PRICE_PKR, 'validation.catalog.priceMax');

const countField = (max: number) =>
  z
    .number({ invalid_type_error: 'validation.catalog.numberInvalid' })
    .int('validation.catalog.wholeNumber')
    .min(0, 'validation.catalog.negative')
    .max(max, 'validation.catalog.tooLarge');

export const UNIT_TYPES = [
  { value: 'PIECE', label: 'Piece' },
  { value: 'PACK', label: 'Pack' },
  { value: 'KG', label: 'Kilogram (kg)' },
  { value: 'G', label: 'Gram (g)' },
  { value: 'LITER', label: 'Litre (L)' },
  { value: 'ML', label: 'Millilitre (ml)' },
  { value: 'DOZEN', label: 'Dozen' },
  { value: 'BOX', label: 'Box' },
  { value: 'BOTTLE', label: 'Bottle' },
] as const;

const unitTypeField = z.enum(['PIECE', 'PACK', 'KG', 'G', 'LITER', 'ML', 'DOZEN', 'BOX', 'BOTTLE']);

// --- Category ------------------------------------------------------------

export const categoryFormSchema = z.object({
  name: z.string().trim().min(2, 'validation.catalog.categoryName').max(80, 'validation.catalog.nameTooLong'),
  description: z.string().max(400, 'validation.catalog.descriptionTooLong'),
  icon: z.string().max(40, 'validation.tooLong'),
  imageUrl: z.string().max(500, 'validation.tooLong'),
  /** Empty string means "top level"; the mapper turns it into null. */
  parentId: z.string(),
  displayOrder: countField(9999),
  isActive: z.boolean(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

/** Blank optional text is omitted rather than sent as an empty string. */
const orUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export function toCategoryInput(values: CategoryFormValues): CategoryInput {
  return {
    name: values.name.trim(),
    description: orUndefined(values.description),
    icon: orUndefined(values.icon),
    imageUrl: orUndefined(values.imageUrl),
    parentId: values.parentId || null,
    displayOrder: values.displayOrder,
    isActive: values.isActive,
  };
}

// --- Product -------------------------------------------------------------

export const productFormSchema = z
  .object({
    name: z.string().trim().min(2, 'validation.catalog.productName').max(160, 'validation.catalog.nameTooLong'),
    brand: z.string().max(80, 'validation.tooLong'),
    shortDescription: z.string().max(200, 'validation.tooLong'),
    description: z.string().max(4000, 'validation.tooLong'),

    /**
     * Either an existing category id, or a name to create.
     *
     * Modelled as a pair rather than a bare id so the form knows, without
     * guessing, whether saving has to create a category first — and so the
     * "about to create" state can be shown to the admin before it happens.
     */
    categoryId: z.string(),
    categoryCreateName: z.string(),

    subcategoryId: z.string(),
    subcategoryCreateName: z.string(),

    /**
     * Uploaded already — the form holds only the stored path. Alt text is
     * required on every one, and the server rejects a blank one too: an image
     * with no description is invisible to a screen reader, and on a grocery
     * app the photograph is often the product identification.
     */
    images: z
      .array(
        z.object({
          url: z.string().min(1),
          alt: z
            .string()
            .trim()
            .min(1, 'validation.catalog.altRequired')
            .max(160, 'validation.catalog.descriptionTooLong'),
          sortOrder: z.number().int().min(0).max(99),
        }),
      )
      .max(8, 'validation.catalog.maxImages'),

    sellingPrice: priceField,
    /**
     * Kept as text so "no discount" can be expressed by clearing the field.
     * A number input cannot distinguish empty from zero without this.
     */
    compareAtPrice: z
      .string()
      .refine(
        (value) => value.trim() === '' || /^[0-9]+$/.test(value.trim()),
        'validation.catalog.compareWhole',
      ),

    unitType: unitTypeField,
    unitValue: z
      .number({ invalid_type_error: 'validation.catalog.packSizeInvalid' })
      .positive('validation.catalog.packSizePositive')
      .max(100_000, 'validation.catalog.tooLarge'),

    sku: z
      .string()
      .trim()
      .min(1, 'validation.catalog.skuRequired')
      .max(40, 'validation.tooLong')
      .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, 'validation.catalog.skuFormat'),

    barcode: z
      .string()
      .refine(
        (value) => value.trim() === '' || /^[0-9]{6,32}$/.test(value.trim()),
        'validation.catalog.barcodeFormat',
      ),

    /** Comma-separated aliases; the mapper splits them. */
    searchTerms: z.string().max(600, 'validation.tooLong'),

    isActive: z.boolean(),
    isFeatured: z.boolean(),

    initialQuantity: countField(1_000_000),
    lowStockThreshold: countField(100_000),
  })
  .refine((values) => Boolean(values.categoryId || values.categoryCreateName.trim()), {
    message: 'validation.catalog.categoryRequired',
    path: ['categoryId'],
  })
  .refine(
    (values) =>
      values.compareAtPrice.trim() === '' || Number(values.compareAtPrice) > values.sellingPrice,
    {
      // Mirrors the schema-level rule on the server: a struck-through price that
      // is not higher would advertise a discount that does not exist.
      message: 'validation.catalog.wasPriceHigher',
      path: ['compareAtPrice'],
    },
  );

export type ProductFormValues = z.infer<typeof productFormSchema>;

/**
 * Turns a filled-in form into an API request.
 *
 * `categoryId` and `subcategoryId` are passed in rather than read from the
 * form, because a category the admin asked to create does not have an id until
 * it has been created — that happens in the submit handler, immediately before
 * this call. Taking them as arguments makes it impossible to forget: there is
 * no way to build a payload without having resolved them first.
 */
export function toProductInput(
  values: ProductFormValues,
  options: {
    includeOpeningStock: boolean;
    categoryId: string;
    subcategoryId: string | null;
  },
): ProductInput {
  const compareAtPrice = values.compareAtPrice.trim();

  return {
    name: values.name.trim(),
    brand: orUndefined(values.brand),
    shortDescription: orUndefined(values.shortDescription),
    description: orUndefined(values.description),
    categoryId: options.categoryId,
    subcategoryId: options.subcategoryId,
    images: values.images.map((image, index) => ({
      url: image.url,
      alt: image.alt.trim(),
      // Re-derived from position: the array order is what the admin arranged,
      // and a stale sortOrder from a removed item would contradict it.
      sortOrder: index,
    })),
    sellingPrice: values.sellingPrice,
    // Explicit null clears an existing discount; the server accepts that.
    compareAtPrice: compareAtPrice === '' ? null : Number(compareAtPrice),
    unitType: values.unitType,
    unitValue: values.unitValue,
    sku: values.sku.trim(),
    barcode: orUndefined(values.barcode),
    searchTerms: values.searchTerms
      .split(',')
      .map((term) => term.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20),
    isActive: values.isActive,
    isFeatured: values.isFeatured,
    // Opening stock belongs to creation only; afterwards the inventory screen
    // is the single writer of a quantity.
    ...(options.includeOpeningStock
      ? {
          initialQuantity: values.initialQuantity,
          lowStockThreshold: values.lowStockThreshold,
        }
      : {}),
  };
}

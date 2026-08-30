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
  .number({ invalid_type_error: 'Enter a price in rupees' })
  .int('Enter whole rupees, with no paisa')
  .min(1, 'Price must be at least Rs. 1')
  .max(MAX_PRICE_PKR, 'That price looks too high');

const countField = (max: number) =>
  z.number({ invalid_type_error: 'Enter a number' }).int('Enter a whole number').min(0).max(max);

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
  name: z.string().trim().min(2, 'Give the category a name').max(80, 'That name is too long'),
  description: z.string().max(400, 'That description is too long'),
  icon: z.string().max(40),
  imageUrl: z.string().max(500),
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
    name: z.string().trim().min(2, 'Give the product a name').max(160, 'That name is too long'),
    brand: z.string().max(80),
    shortDescription: z.string().max(200),
    description: z.string().max(4000),

    categoryId: z.string().min(1, 'Choose a category'),
    subcategoryId: z.string(),

    sellingPrice: priceField,
    /**
     * Kept as text so "no discount" can be expressed by clearing the field.
     * A number input cannot distinguish empty from zero without this.
     */
    compareAtPrice: z
      .string()
      .refine(
        (value) => value.trim() === '' || /^[0-9]+$/.test(value.trim()),
        'Enter whole rupees, or leave blank for no discount',
      ),

    unitType: unitTypeField,
    unitValue: z
      .number({ invalid_type_error: 'Enter a pack size' })
      .positive('Pack size must be more than zero')
      .max(100_000),

    sku: z
      .string()
      .trim()
      .min(1, 'An item code is required')
      .max(40)
      .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, 'Use letters, digits and hyphens only'),

    barcode: z
      .string()
      .refine(
        (value) => value.trim() === '' || /^[0-9]{6,32}$/.test(value.trim()),
        'A barcode is 6 to 32 digits, or leave it blank',
      ),

    /** Comma-separated aliases; the mapper splits them. */
    searchTerms: z.string().max(600),

    isActive: z.boolean(),
    isFeatured: z.boolean(),

    initialQuantity: countField(1_000_000),
    lowStockThreshold: countField(100_000),
  })
  .refine(
    (values) =>
      values.compareAtPrice.trim() === '' || Number(values.compareAtPrice) > values.sellingPrice,
    {
      // Mirrors the schema-level rule on the server: a struck-through price that
      // is not higher would advertise a discount that does not exist.
      message: 'The “was” price must be higher than the selling price',
      path: ['compareAtPrice'],
    },
  );

export type ProductFormValues = z.infer<typeof productFormSchema>;

export function toProductInput(
  values: ProductFormValues,
  options: { includeOpeningStock: boolean },
): ProductInput {
  const compareAtPrice = values.compareAtPrice.trim();

  return {
    name: values.name.trim(),
    brand: orUndefined(values.brand),
    shortDescription: orUndefined(values.shortDescription),
    description: orUndefined(values.description),
    categoryId: values.categoryId,
    subcategoryId: values.subcategoryId || null,
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

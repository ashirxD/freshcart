import { Error as MongooseError, Types, model } from 'mongoose';
import { UnitType } from 'src/common/enums';
import { Product, ProductSchema } from './product.schema';

/**
 * These invariants live on the schema so no write path — API, seeder or a
 * one-off script — can bypass them. `validate()` exercises them with no
 * database connection, which is exactly the level they are defined at.
 *
 * Note it must be the async `validate()`: `validateSync()` skips `pre('validate')`
 * hooks entirely, so the custom rules below would silently never run.
 */
const ProductModel = model<Product>('ProductSchemaSpec', ProductSchema);

function build(overrides: Partial<Product> = {}) {
  return new ProductModel({
    name: "Olper's Full Cream Milk",
    slug: 'olpers-full-cream-milk',
    categoryId: new Types.ObjectId(),
    storeId: new Types.ObjectId(),
    sellingPrice: 240,
    unitType: UnitType.LITER,
    unitValue: 1,
    sku: 'FC-DAI-001',
    ...overrides,
  });
}

/** Returns the field errors from a failed validation, or null when it passed. */
async function validationErrors(
  document: ReturnType<typeof build>,
): Promise<Record<string, { message: string }> | null> {
  try {
    await document.validate();
    return null;
  } catch (error) {
    if (error instanceof MongooseError.ValidationError) {
      return error.errors as unknown as Record<string, { message: string }>;
    }
    throw error;
  }
}

describe('Product schema invariants', () => {
  it('accepts a well-formed product', async () => {
    await expect(validationErrors(build())).resolves.toBeNull();
  });

  describe('compare-at price', () => {
    it('accepts a genuine discount', async () => {
      await expect(
        validationErrors(build({ sellingPrice: 240, compareAtPrice: 280 })),
      ).resolves.toBeNull();
    });

    it('rejects a compare-at price equal to the selling price', async () => {
      const errors = await validationErrors(build({ sellingPrice: 240, compareAtPrice: 240 }));
      expect(errors?.compareAtPrice.message).toMatch(/greater than sellingPrice/);
    });

    it('rejects a compare-at price below the selling price', async () => {
      // Otherwise the card would advertise a saving that does not exist.
      const errors = await validationErrors(build({ sellingPrice: 240, compareAtPrice: 200 }));
      expect(errors?.compareAtPrice).toBeDefined();
    });

    it('accepts no discount at all', async () => {
      await expect(validationErrors(build({ compareAtPrice: null }))).resolves.toBeNull();
    });
  });

  describe('unit pairs', () => {
    it('allows a fractional size for a measurable unit', async () => {
      await expect(
        validationErrors(build({ unitType: UnitType.LITER, unitValue: 1.5 })),
      ).resolves.toBeNull();
    });

    it('rejects a fractional count for a discrete unit', async () => {
      // "0.5 dozen eggs" is a count of six, not half a dozen-unit.
      const errors = await validationErrors(build({ unitType: UnitType.DOZEN, unitValue: 0.5 }));
      expect(errors?.unitValue.message).toMatch(/whole number/);
    });

    it('allows a whole count for a discrete unit', async () => {
      await expect(
        validationErrors(build({ unitType: UnitType.PACK, unitValue: 3 })),
      ).resolves.toBeNull();
    });
  });

  describe('required fields', () => {
    it('rejects a product with no category', async () => {
      const product = build();
      product.set('categoryId', undefined);
      expect((await validationErrors(product))?.categoryId).toBeDefined();
    });

    it('rejects a free price', async () => {
      expect((await validationErrors(build({ sellingPrice: 0 })))?.sellingPrice).toBeDefined();
    });

    it('uppercases the SKU so lookups are case-insensitive by construction', () => {
      expect(build({ sku: 'fc-dai-001' }).sku).toBe('FC-DAI-001');
    });
  });
});

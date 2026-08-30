import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { ProductDocument } from 'src/modules/products/schemas';
import { StoresService } from 'src/modules/stores';
import { CategoriesService } from './categories.service';
import { CategoryDocument } from './schemas';

const STORE_ID = new Types.ObjectId('64b000000000000000000001');

const id = (hex: string) => new Types.ObjectId(hex.padStart(24, '0'));

/** Mongoose query builders are chainable; this fakes just enough of the chain. */
function chain<T>(result: T) {
  const query = {
    select: () => query,
    sort: () => query,
    skip: () => query,
    limit: () => query,
    lean: () => query,
    exec: () => Promise.resolve(result),
  };
  return query;
}

interface CategoryRow {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  parentId: Types.ObjectId | null;
  isActive: boolean;
  displayOrder: number;
  storeId: Types.ObjectId;
}

function row(overrides: Partial<CategoryRow> & { _id: Types.ObjectId }): CategoryRow {
  return {
    name: 'Category',
    slug: 'category',
    parentId: null,
    isActive: true,
    displayOrder: 0,
    storeId: STORE_ID,
    ...overrides,
  };
}

describe('CategoriesService', () => {
  const DAIRY = id('a1');
  const MILK = id('a2');

  // Mongoose's model types are heavily overloaded; a plain map of jest mocks
  // keeps these tests about behaviour rather than about satisfying those types.
  type MockModel = Record<string, jest.Mock>;

  let categoryModel: MockModel;
  let productModel: MockModel;
  let service: CategoriesService;

  beforeEach(() => {
    categoryModel = {
      find: jest.fn().mockReturnValue(chain([])),
      findOne: jest.fn().mockReturnValue(chain(null)),
      findById: jest.fn().mockReturnValue(chain(null)),
      create: jest.fn(),
      exists: jest.fn().mockResolvedValue(null),
      countDocuments: jest.fn().mockReturnValue(chain(0)),
      updateMany: jest.fn().mockReturnValue(chain({ modifiedCount: 0 })),
      bulkWrite: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      deleteOne: jest.fn().mockReturnValue(chain(undefined)),
    };

    productModel = {
      countDocuments: jest.fn().mockReturnValue(chain(0)),
      aggregate: jest.fn().mockReturnValue(chain([])),
    };

    const storesService = {
      getActiveStoreObjectId: jest.fn().mockResolvedValue(STORE_ID),
    } as unknown as StoresService;

    service = new CategoriesService(
      categoryModel as unknown as Model<CategoryDocument>,
      productModel as unknown as Model<ProductDocument>,
      storesService,
    );
  });

  describe('create', () => {
    it('derives the slug from the name and scopes the category to the active store', async () => {
      categoryModel.create.mockResolvedValue({ slug: 'frozen-foods' });

      await service.create({ name: 'Frozen Foods' });

      expect(categoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Frozen Foods',
          slug: 'frozen-foods',
          parentId: null,
          storeId: STORE_ID,
        }),
      );
    });

    it('de-duplicates a slug that is already taken in the store', async () => {
      categoryModel.exists.mockImplementation((filter) =>
        Promise.resolve((filter as { slug: string }).slug === 'dairy' ? { _id: DAIRY } : null),
      );
      categoryModel.create.mockResolvedValue({ slug: 'dairy-2' });

      await service.create({ name: 'Dairy' });

      expect(categoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'dairy-2' }),
      );
    });

    it('rejects a parent that does not exist', async () => {
      categoryModel.findOne.mockReturnValue(chain(null));

      await expect(
        service.create({ name: 'Ice Cream', parentId: DAIRY.toHexString() }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects nesting under a category that is itself a subcategory', async () => {
      // MILK already has DAIRY as its parent, so it cannot take children.
      categoryModel.findOne.mockReturnValue(chain(row({ _id: MILK, parentId: DAIRY })) as never);

      await expect(
        service.create({ name: 'Flavoured Milk', parentId: MILK.toHexString() }),
      ).rejects.toThrow(/nest one level deep/);
    });

    it('rejects a name with nothing sluggable in it', async () => {
      await expect(service.create({ name: '###' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    function documentFor(overrides: Partial<CategoryRow> & { _id: Types.ObjectId }) {
      const document = { ...row(overrides), save: jest.fn() };
      document.save.mockResolvedValue(document);
      return document;
    }

    it('refuses to make a category its own parent', async () => {
      const document = documentFor({ _id: DAIRY });
      categoryModel.findOne.mockReturnValueOnce(chain(document));

      await expect(
        service.update(DAIRY.toHexString(), { parentId: DAIRY.toHexString() }),
      ).rejects.toThrow(/its own parent/);
    });

    it('refuses to demote a category that already has subcategories', async () => {
      const other = id('b1');
      const document = documentFor({ _id: DAIRY });

      categoryModel.findOne
        // the category being updated
        .mockReturnValueOnce(chain(document))
        // the proposed parent, a valid top-level category
        .mockReturnValueOnce(chain(row({ _id: other })));
      categoryModel.exists.mockResolvedValue({ _id: MILK });

      await expect(
        service.update(DAIRY.toHexString(), { parentId: other.toHexString() }),
      ).rejects.toThrow(/has subcategories/);
    });

    it('detects a cycle when the proposed parent descends from this category', async () => {
      const grandchild = id('c1');
      const document = documentFor({ _id: DAIRY });

      categoryModel.findOne
        .mockReturnValueOnce(chain(document))
        // The proposed parent's own parent is the category being edited.
        .mockReturnValueOnce(chain(row({ _id: grandchild, parentId: DAIRY })));

      await expect(
        service.update(DAIRY.toHexString(), { parentId: grandchild.toHexString() }),
      ).rejects.toThrow(/would create a loop/);
    });

    it('reports a missing category as 404', async () => {
      categoryModel.findOne.mockReturnValue(chain(null));

      await expect(service.update(DAIRY.toHexString(), { name: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('setActive', () => {
    it('deactivates the subcategories along with the parent', async () => {
      const document = { ...row({ _id: DAIRY }), save: jest.fn() };
      document.save.mockResolvedValue(document);
      categoryModel.findOne.mockReturnValue(chain(document));
      categoryModel.updateMany.mockReturnValue(chain({ modifiedCount: 4 }));

      await service.setActive(DAIRY.toHexString(), false);

      expect(document.isActive).toBe(false);
      expect(categoryModel.updateMany).toHaveBeenCalledWith(
        { storeId: STORE_ID, parentId: DAIRY },
        { $set: { isActive: false } },
      );
    });

    it('does not cascade when reactivating', async () => {
      const document = { ...row({ _id: DAIRY, isActive: false }), save: jest.fn() };
      document.save.mockResolvedValue(document);
      categoryModel.findOne.mockReturnValue(chain(document));

      await service.setActive(DAIRY.toHexString(), true);

      // Reactivating a parent must not silently un-hide children an admin
      // deliberately turned off.
      expect(categoryModel.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    function deletableDocument() {
      const document = { ...row({ _id: MILK, slug: 'milk' }), deleteOne: jest.fn() };
      document.deleteOne.mockResolvedValue(undefined);
      categoryModel.findOne.mockReturnValue(chain(document));
      return document;
    }

    it('refuses to delete a category that still has products', async () => {
      deletableDocument();
      productModel.countDocuments.mockReturnValue(chain(3));

      await expect(service.remove(MILK.toHexString())).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses to delete a category that still has subcategories', async () => {
      deletableDocument();
      categoryModel.countDocuments.mockReturnValue(chain(4));

      await expect(service.remove(MILK.toHexString())).rejects.toThrow(/subcategories/);
    });

    it('deletes a category that is genuinely unused', async () => {
      const document = deletableDocument();

      await expect(service.remove(MILK.toHexString())).resolves.toEqual({
        deleted: true,
        id: MILK.toHexString(),
      });
      expect(document.deleteOne).toHaveBeenCalled();
    });
  });

  describe('assertValidProductCategories', () => {
    it('rejects a subcategory used as the primary category', async () => {
      categoryModel.findOne.mockReturnValue(chain(row({ _id: MILK, parentId: DAIRY })));

      await expect(
        service.assertValidProductCategories(MILK.toHexString(), null, STORE_ID),
      ).rejects.toThrow(/must be a top-level category/);
    });

    it('rejects a subcategory belonging to a different parent', async () => {
      const otherParent = id('d1');

      categoryModel.findOne
        .mockReturnValueOnce(chain(row({ _id: DAIRY })))
        .mockReturnValueOnce(chain(row({ _id: MILK, parentId: otherParent })));

      await expect(
        service.assertValidProductCategories(DAIRY.toHexString(), MILK.toHexString(), STORE_ID),
      ).rejects.toThrow(/must be a child of the selected category/);
    });

    it('accepts a valid parent/child pair', async () => {
      categoryModel.findOne
        .mockReturnValueOnce(chain(row({ _id: DAIRY })))
        .mockReturnValueOnce(chain(row({ _id: MILK, parentId: DAIRY })));

      await expect(
        service.assertValidProductCategories(DAIRY.toHexString(), MILK.toHexString(), STORE_ID),
      ).resolves.toEqual({ categoryId: DAIRY, subcategoryId: MILK });
    });
  });

  describe('resolveFilterIds', () => {
    it('expands a top-level category to include its subcategories', async () => {
      categoryModel.findOne.mockReturnValue(chain(row({ _id: DAIRY })));
      categoryModel.find.mockReturnValue(chain([{ _id: MILK }]));

      await expect(service.resolveFilterIds('dairy-eggs', STORE_ID)).resolves.toEqual([
        DAIRY,
        MILK,
      ]);
    });

    it('resolves to nothing for an inactive category, so it filters everything out', async () => {
      categoryModel.findOne.mockReturnValue(chain(row({ _id: DAIRY, isActive: false })));

      await expect(service.resolveFilterIds('dairy-eggs', STORE_ID)).resolves.toEqual([]);
    });
  });
});

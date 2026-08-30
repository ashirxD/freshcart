import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { slugify, uniqueSlug } from 'src/common/utils';
import { Product, ProductDocument } from 'src/modules/products/schemas';
import { StoresService } from 'src/modules/stores';
import {
  CreateCategoryDto,
  QueryCategoriesDto,
  ReorderCategoriesDto,
  UpdateCategoryDto,
} from './dto';
import { Category, CategoryDocument, MAX_CATEGORY_DEPTH } from './schemas';

/** The category shape that crosses the API boundary. */
export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  icon?: string;
  parentId: string | null;
  isActive: boolean;
  displayOrder: number;
  /** Present only when the caller asked for counts. */
  productCount?: number;
  children: CategoryView[];
}

/** A single category plus the context a category page needs to render. */
export interface CategoryDetail extends CategoryView {
  /** Root-first path to this category, for breadcrumbs. */
  ancestors: Array<Pick<CategoryView, 'id' | 'name' | 'slug'>>;
}

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    /**
     * Read-only use of the product collection, for product counts and for the
     * "is this category still in use?" guard. Categories sit *below* products in
     * the dependency order (products reference categories, not the reverse), so
     * injecting ProductsService here would create a module cycle. Two narrow
     * queries against the model are the cheaper trade.
     */
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly storesService: StoresService,
  ) {}

  /**
   * The catalogue tree. Loads every matching category in one query and assembles
   * the hierarchy in memory — the tree is small and bounded, so recursive
   * `$graphLookup` would cost more than it saves.
   */
  async list(query: QueryCategoriesDto, options: { includeInactive?: boolean } = {}) {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const includeInactive = options.includeInactive === true;

    const filter: FilterQuery<CategoryDocument> = { storeId };
    if (!includeInactive) filter.isActive = true;

    const documents = await this.categoryModel
      .find(filter)
      .sort({ displayOrder: 1, name: 1 })
      .lean()
      .exec();

    const counts = query.withProductCount
      ? await this.countProductsByCategory(storeId, includeInactive)
      : null;

    const nodes = documents.map((document) => this.toView(document, counts));

    const scoped = query.parent ? this.scopeToParent(nodes, query.parent) : nodes;

    return query.flat ? scoped.map((node) => ({ ...node, children: [] })) : this.buildTree(scoped);
  }

  /** Resolves by id or slug so the storefront can use readable URLs. */
  async findOneOrFail(
    idOrSlug: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<CategoryDetail> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const document = await this.resolve(idOrSlug, storeId);

    if (!document) throw new NotFoundException('Category not found');
    if (!document.isActive && !options.includeInactive) {
      throw new NotFoundException('Category not found');
    }

    const [children, ancestors] = await Promise.all([
      this.categoryModel
        .find({
          parentId: document._id,
          ...(options.includeInactive ? {} : { isActive: true }),
        })
        .sort({ displayOrder: 1, name: 1 })
        .lean()
        .exec(),
      this.loadAncestors(document),
    ]);

    return {
      ...this.toView(document, null),
      children: children.map((child) => this.toView(child, null)),
      ancestors: ancestors.map((ancestor) => ({
        id: ancestor._id.toString(),
        name: ancestor.name,
        slug: ancestor.slug,
      })),
    };
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDocument> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const parentId = await this.resolveParent(dto.parentId ?? null, storeId, null);
    const slug = await this.resolveSlug(dto.slug ?? dto.name, storeId);

    const category = await this.categoryModel.create({
      name: dto.name.trim(),
      slug,
      description: dto.description,
      imageUrl: dto.imageUrl,
      icon: dto.icon,
      parentId,
      storeId,
      displayOrder: dto.displayOrder ?? 0,
      isActive: dto.isActive ?? true,
    });

    this.logger.log('Category created: ' + category.slug);
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDocument> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const category = await this.findDocumentOrFail(id, storeId);

    if (dto.parentId !== undefined) {
      category.parentId = await this.resolveParent(dto.parentId, storeId, category._id);
    }

    if (dto.slug !== undefined && dto.slug !== category.slug) {
      category.slug = await this.resolveSlug(dto.slug, storeId, category._id);
    }

    if (dto.name !== undefined) category.name = dto.name.trim();
    if (dto.description !== undefined) category.description = dto.description;
    if (dto.imageUrl !== undefined) category.imageUrl = dto.imageUrl;
    if (dto.icon !== undefined) category.icon = dto.icon;
    if (dto.displayOrder !== undefined) category.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;

    return category.save();
  }

  /**
   * Deactivating a parent hides its whole branch from customers, so the children
   * are deactivated with it. Doing that here rather than filtering at read time
   * keeps `isActive` meaning exactly one thing everywhere it is queried.
   */
  async setActive(id: string, isActive: boolean): Promise<CategoryDocument> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const category = await this.findDocumentOrFail(id, storeId);

    category.isActive = isActive;
    const saved = await category.save();

    if (!isActive) {
      const { modifiedCount } = await this.categoryModel
        .updateMany({ storeId, parentId: category._id }, { $set: { isActive: false } })
        .exec();

      if (modifiedCount > 0) {
        this.logger.log('Deactivated ' + modifiedCount + ' subcategories under ' + category.slug);
      }
    }

    return saved;
  }

  /** Applies a whole reorder atomically, so the list is never half-updated. */
  async reorder(dto: ReorderCategoriesDto): Promise<{ updated: number }> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const ids = dto.categories.map((entry) => new Types.ObjectId(entry.id));

    const owned = await this.categoryModel.countDocuments({ _id: { $in: ids }, storeId }).exec();
    if (owned !== ids.length) {
      throw new BadRequestException('One or more categories do not belong to this store');
    }

    const result = await this.categoryModel.bulkWrite(
      dto.categories.map((entry) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(entry.id), storeId },
          update: { $set: { displayOrder: entry.displayOrder } },
        },
      })),
      { ordered: false },
    );

    return { updated: result.modifiedCount };
  }

  /**
   * Deletion is only allowed when it cannot orphan anything.
   *
   * A category with products or subcategories is refused with an explanation:
   * silently cascading would destroy catalogue data, and reassigning products
   * behind the admin's back would be worse. Deactivation is the safe path and
   * the error says so.
   */
  async remove(id: string): Promise<{ deleted: true; id: string }> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const category = await this.findDocumentOrFail(id, storeId);

    const [childCount, productCount] = await Promise.all([
      this.categoryModel.countDocuments({ parentId: category._id }).exec(),
      this.productModel
        .countDocuments({
          $or: [{ categoryId: category._id }, { subcategoryId: category._id }],
        })
        .exec(),
    ]);

    if (childCount > 0) {
      throw new ConflictException(
        'This category has ' +
          childCount +
          ' subcategories. Move or delete them first, or deactivate this category instead.',
      );
    }

    if (productCount > 0) {
      throw new ConflictException(
        'This category still has ' +
          productCount +
          ' products. Reassign them to another category first, or deactivate this category instead.',
      );
    }

    await category.deleteOne();
    this.logger.log('Category deleted: ' + category.slug);

    return { deleted: true, id: category._id.toString() };
  }

  /**
   * Validates a category reference coming from a product write.
   * Returns the resolved ids so ProductsService never has to re-query.
   */
  async assertValidProductCategories(
    categoryId: string,
    subcategoryId: string | null | undefined,
    storeId: Types.ObjectId,
  ): Promise<{ categoryId: Types.ObjectId; subcategoryId: Types.ObjectId | null }> {
    const category = await this.categoryModel
      .findOne({ _id: new Types.ObjectId(categoryId), storeId })
      .select('_id parentId')
      .lean()
      .exec();

    if (!category)
      throw new BadRequestException('categoryId does not match a category in this store');
    if (category.parentId) {
      throw new BadRequestException(
        'categoryId must be a top-level category; pass the child as subcategoryId',
      );
    }

    if (!subcategoryId) return { categoryId: category._id, subcategoryId: null };

    const subcategory = await this.categoryModel
      .findOne({ _id: new Types.ObjectId(subcategoryId), storeId })
      .select('_id parentId')
      .lean()
      .exec();

    if (!subcategory) {
      throw new BadRequestException('subcategoryId does not match a category in this store');
    }
    if (!subcategory.parentId?.equals(category._id)) {
      throw new BadRequestException('subcategoryId must be a child of the selected category');
    }

    return { categoryId: category._id, subcategoryId: subcategory._id };
  }

  /**
   * Expands a category reference into the set of ids a product filter should
   * match: a top-level category also matches everything in its subcategories.
   */
  async resolveFilterIds(idOrSlug: string, storeId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const category = await this.resolve(idOrSlug, storeId);
    if (!category || !category.isActive) return [];

    const children = await this.categoryModel
      .find({ parentId: category._id, isActive: true })
      .select('_id')
      .lean()
      .exec();

    return [category._id, ...children.map((child) => child._id)];
  }

  private async findDocumentOrFail(id: string, storeId: Types.ObjectId): Promise<CategoryDocument> {
    const category = await this.categoryModel.findOne({ _id: id, storeId }).exec();
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  private resolve(idOrSlug: string, storeId: Types.ObjectId) {
    const filter: FilterQuery<CategoryDocument> = Types.ObjectId.isValid(idOrSlug)
      ? { _id: new Types.ObjectId(idOrSlug), storeId }
      : { slug: idOrSlug.toLowerCase(), storeId };

    return this.categoryModel.findOne(filter).lean().exec();
  }

  /**
   * Validates a proposed parent and refuses anything that would create a cycle
   * or exceed the supported depth.
   */
  private async resolveParent(
    parentId: string | null,
    storeId: Types.ObjectId,
    selfId: Types.ObjectId | null,
  ): Promise<Types.ObjectId | null> {
    if (!parentId) return null;

    const parentObjectId = new Types.ObjectId(parentId);

    if (selfId?.equals(parentObjectId)) {
      throw new BadRequestException('A category cannot be its own parent');
    }

    const parent = await this.categoryModel
      .findOne({ _id: parentObjectId, storeId })
      .select('_id parentId')
      .lean()
      .exec();

    if (!parent) throw new BadRequestException('The selected parent category does not exist');

    // Walk up from the proposed parent. With MAX_CATEGORY_DEPTH at 2 this can
    // only ever take one step, but the walk keeps the guarantee if the depth
    // limit is ever raised.
    let cursor = parent.parentId;
    for (let depth = 0; cursor && depth < MAX_CATEGORY_DEPTH + 1; depth += 1) {
      if (selfId?.equals(cursor)) {
        throw new BadRequestException(
          'That parent is a descendant of this category, which would create a loop',
        );
      }

      const ancestor = await this.categoryModel.findById(cursor).select('parentId').lean().exec();
      cursor = ancestor?.parentId ?? null;
    }

    if (parent.parentId) {
      throw new BadRequestException(
        'Categories nest one level deep. Choose a top-level category as the parent.',
      );
    }

    if (selfId) {
      const hasChildren = await this.categoryModel.exists({ parentId: selfId });
      if (hasChildren) {
        throw new BadRequestException(
          'This category has subcategories, so it cannot itself become a subcategory',
        );
      }
    }

    return parent._id;
  }

  private async resolveSlug(
    source: string,
    storeId: Types.ObjectId,
    excludeId?: Types.ObjectId,
  ): Promise<string> {
    if (!slugify(source)) {
      throw new BadRequestException('Category name must contain at least one letter or digit');
    }

    return uniqueSlug(source, async (candidate) => {
      const filter: FilterQuery<CategoryDocument> = { slug: candidate, storeId };
      if (excludeId) filter._id = { $ne: excludeId };
      return (await this.categoryModel.exists(filter)) !== null;
    });
  }

  private async loadAncestors(category: {
    parentId: Types.ObjectId | null;
  }): Promise<Array<{ _id: Types.ObjectId; name: string; slug: string }>> {
    if (!category.parentId) return [];

    const parent = await this.categoryModel
      .findById(category.parentId)
      .select('_id name slug parentId')
      .lean()
      .exec();

    if (!parent) return [];
    return [...(await this.loadAncestors(parent)), parent];
  }

  /**
   * One aggregation for the whole tree's counts. Counting per category would be
   * a query per node — the N+1 this specifically avoids.
   */
  private async countProductsByCategory(
    storeId: Types.ObjectId,
    includeInactive: boolean,
  ): Promise<Map<string, number>> {
    const match: FilterQuery<ProductDocument> = { storeId };
    if (!includeInactive) match.isActive = true;

    const rows = await this.productModel
      .aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: match },
        {
          $project: {
            categoryIds: {
              $filter: {
                input: ['$categoryId', '$subcategoryId'],
                cond: { $ne: ['$$this', null] },
              },
            },
          },
        },
        { $unwind: '$categoryIds' },
        { $group: { _id: '$categoryIds', count: { $sum: 1 } } },
      ])
      .exec();

    return new Map(rows.map((row) => [row._id.toString(), row.count]));
  }

  private toView(
    document: {
      _id: Types.ObjectId;
      name: string;
      slug: string;
      description?: string;
      imageUrl?: string;
      icon?: string;
      parentId: Types.ObjectId | null;
      isActive: boolean;
      displayOrder: number;
    },
    counts: Map<string, number> | null,
  ): CategoryView {
    const id = document._id.toString();

    return {
      id,
      name: document.name,
      slug: document.slug,
      description: document.description,
      imageUrl: document.imageUrl,
      icon: document.icon,
      parentId: document.parentId ? document.parentId.toString() : null,
      isActive: document.isActive,
      displayOrder: document.displayOrder,
      ...(counts ? { productCount: counts.get(id) ?? 0 } : {}),
      children: [],
    };
  }

  /** Attaches children to parents; orphans (parent filtered out) become roots. */
  private buildTree(nodes: CategoryView[]): CategoryView[] {
    const byId = new Map(
      nodes.map((node) => [node.id, { ...node, children: [] as CategoryView[] }]),
    );
    const roots: CategoryView[] = [];

    for (const node of byId.values()) {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    return roots;
  }

  private scopeToParent(nodes: CategoryView[], parent: string): CategoryView[] {
    const root = nodes.find((node) => node.id === parent || node.slug === parent);
    if (!root) return [];
    return nodes.filter((node) => node.parentId === root.id);
  }
}

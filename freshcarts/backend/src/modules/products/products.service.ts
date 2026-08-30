import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PipelineStage, Types } from 'mongoose';
import { PaginatedResult, paginated } from 'src/common/dto';
import { escapeRegExp, slugify, uniqueSlug } from 'src/common/utils';
import { CategoriesService } from 'src/modules/categories';
import { Category, CategoryDocument } from 'src/modules/categories/schemas';
import { Cart, CartDocument } from 'src/modules/cart/schemas';
import { Favorite, FavoriteDocument } from 'src/modules/favorites/schemas';
import { INVENTORY_COLLECTION } from 'src/modules/inventory/schemas';
import { InventoryService, StockView } from 'src/modules/inventory/inventory.service';
import { StoresService } from 'src/modules/stores';
import { CreateProductDto, ProductSort, QueryProductsDto, UpdateProductDto } from './dto';
import {
  LeanProduct,
  ProductDetailView,
  ProductView,
  toProductDetailView,
  toProductView,
} from './product.view';
import { Product, ProductDocument } from './schemas';

/** Raw pipeline output: a product document with its joined stock row. */
type ProductWithStock = LeanProduct & {
  stockRow?: Array<{ quantity: number; lowStockThreshold: number }>;
};

const RELATED_PRODUCT_LIMIT = 8;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    /**
     * Read-only, used solely by the delete-safety guard below. Cart and
     * favourites depend on products, so their services cannot be injected here —
     * two `exists` queries against the models keep the modules acyclic.
     */
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<FavoriteDocument>,
    private readonly categoriesService: CategoriesService,
    private readonly inventoryService: InventoryService,
    private readonly storesService: StoresService,
  ) {}

  // --- Reads -------------------------------------------------------------

  async list(
    query: QueryProductsDto,
    options: { includeInactive?: boolean } = {},
  ): Promise<PaginatedResult<ProductView>> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const includeInactive = options.includeInactive === true;

    const match = await this.buildMatch(query, storeId, includeInactive);
    const { sort, addFields } = this.buildSort(query);

    const { items, total } = await this.runQuery({
      storeId,
      match,
      sort,
      addFields,
      requireInStock: query.inStock === true,
      skip: query.skip,
      limit: query.limit,
      countTotal: true,
    });

    return paginated(items, total, { page: query.page, limit: query.limit });
  }

  async findOneOrFail(
    idOrSlug: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<ProductDetailView> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const product = await this.resolve(idOrSlug, storeId);

    if (!product) throw new NotFoundException('Product not found');
    if (!product.isActive && !options.includeInactive) {
      throw new NotFoundException('Product not found');
    }

    const categoryIds = [product.categoryId, product.subcategoryId].filter(
      (id): id is Types.ObjectId => id !== null,
    );

    const [stock, categories] = await Promise.all([
      this.inventoryService.getFor(product._id, storeId),
      this.categoryModel
        .find({ _id: { $in: categoryIds } })
        .select('_id name slug')
        .lean()
        .exec(),
    ]);

    const byId = new Map(categories.map((category) => [category._id.toString(), category]));

    return toProductDetailView(
      product,
      stock,
      byId.get(product.categoryId.toString()) ?? null,
      product.subcategoryId ? (byId.get(product.subcategoryId.toString()) ?? null) : null,
    );
  }

  /**
   * "Related" here means exactly what it says: other products in the same
   * subcategory, falling back to the same category. No invented affinity
   * scoring — there is no behavioural data yet to base one on.
   */
  async findRelated(idOrSlug: string): Promise<ProductView[]> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const product = await this.resolve(idOrSlug, storeId);

    if (!product || !product.isActive) return [];

    const match: FilterQuery<ProductDocument> = {
      storeId,
      isActive: true,
      _id: { $ne: product._id },
      ...(product.subcategoryId
        ? { subcategoryId: product.subcategoryId }
        : { categoryId: product.categoryId }),
    };

    const { items } = await this.runQuery({
      storeId,
      match,
      sort: { isFeatured: -1, createdAt: -1 },
      skip: 0,
      limit: RELATED_PRODUCT_LIMIT,
      countTotal: false,
    });

    return items;
  }

  /** Distinct brands in the catalogue, for the filter panel. */
  async listBrands(): Promise<string[]> {
    const storeId = await this.storesService.getActiveStoreObjectId();

    const brands = await this.productModel
      .distinct('brand', { storeId, isActive: true, brand: { $nin: [null, ''] } })
      .exec();

    return (brands as string[]).sort((a, b) => a.localeCompare(b));
  }

  /**
   * The authoritative lookup for anything that spends money or reserves stock.
   * Returns the *database* price and stock — never a value supplied by a client.
   */
  async findPurchasableOrFail(
    productId: string | Types.ObjectId,
    storeId: Types.ObjectId,
  ): Promise<{ product: LeanProduct; stock: StockView }> {
    const product = await this.productModel
      .findOne({ _id: productId, storeId })
      .lean<LeanProduct>()
      .exec();

    if (!product) throw new NotFoundException('Product not found');

    if (!product.isActive) {
      throw new ConflictException('"' + product.name + '" is no longer available');
    }

    const stock = await this.inventoryService.getFor(product._id, storeId);
    return { product, stock };
  }

  /** Batch view builder for the cart and favourites screens. */
  async findViewsByIds(
    productIds: Types.ObjectId[],
    storeId: Types.ObjectId,
  ): Promise<Map<string, ProductView>> {
    if (productIds.length === 0) return new Map();

    const [products, stockByProduct] = await Promise.all([
      this.productModel
        .find({ _id: { $in: productIds }, storeId })
        .lean<LeanProduct[]>()
        .exec(),
      this.inventoryService.getManyFor(productIds, storeId),
    ]);

    return new Map(
      products.map((product) => {
        const id = product._id.toString();
        return [
          id,
          toProductView(product, stockByProduct.get(id) ?? InventoryService.toStockView(null)),
        ];
      }),
    );
  }

  // --- Writes ------------------------------------------------------------

  async create(dto: CreateProductDto): Promise<ProductDetailView> {
    const storeId = await this.storesService.getActiveStoreObjectId();

    const { categoryId, subcategoryId } = await this.categoriesService.assertValidProductCategories(
      dto.categoryId,
      dto.subcategoryId,
      storeId,
    );

    const slug = await this.resolveSlug(dto.slug ?? dto.name, storeId);
    const sku = dto.sku.toUpperCase();

    await this.assertSkuAvailable(sku, storeId);

    let product: ProductDocument;

    try {
      product = await this.productModel.create({
        ...this.creationFields(dto),
        slug,
        sku,
        categoryId,
        subcategoryId,
        storeId,
      });
    } catch (error) {
      throw this.translateDuplicateKey(error);
    }

    try {
      await this.inventoryService.ensureFor(product._id, storeId, {
        quantity: dto.initialQuantity ?? 0,
        lowStockThreshold: dto.lowStockThreshold ?? 5,
      });
    } catch (error) {
      // A product with no stock row would read as permanently out of stock and
      // could never be restocked through the inventory API. Roll back instead.
      await this.productModel.deleteOne({ _id: product._id }).exec();
      throw error;
    }

    this.logger.log('Product created: ' + product.sku + ' (' + product.slug + ')');
    return this.findOneOrFail(product._id.toString(), { includeInactive: true });
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDetailView> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const product = await this.productModel.findOne({ _id: id, storeId }).exec();

    if (!product) throw new NotFoundException('Product not found');

    if (dto.categoryId !== undefined || dto.subcategoryId !== undefined) {
      const { categoryId, subcategoryId } =
        await this.categoriesService.assertValidProductCategories(
          dto.categoryId ?? product.categoryId.toString(),
          dto.subcategoryId !== undefined ? dto.subcategoryId : product.subcategoryId?.toString(),
          storeId,
        );

      product.categoryId = categoryId;
      product.subcategoryId = subcategoryId;
    }

    if (dto.slug !== undefined && dto.slug !== product.slug) {
      product.slug = await this.resolveSlug(dto.slug, storeId, product._id);
    }

    if (dto.sku !== undefined) {
      const sku = dto.sku.toUpperCase();
      if (sku !== product.sku) {
        await this.assertSkuAvailable(sku, storeId, product._id);
        product.sku = sku;
      }
    }

    // Assigned field by field rather than by copying an object onto the
    // document: only these properties are writable, and TypeScript checks each
    // one, so a renamed schema field is a compile error instead of a silent
    // no-op. `undefined` means "not sent", which must not clear a value.
    if (dto.name !== undefined) product.name = dto.name.trim();
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.shortDescription !== undefined) product.shortDescription = dto.shortDescription;
    if (dto.brand !== undefined) product.brand = dto.brand.trim();
    if (dto.images !== undefined) product.images = ProductsService.toImages(dto.images);
    if (dto.sellingPrice !== undefined) product.sellingPrice = dto.sellingPrice;
    if (dto.unitType !== undefined) product.unitType = dto.unitType;
    if (dto.unitValue !== undefined) product.unitValue = dto.unitValue;
    if (dto.barcode !== undefined) product.barcode = dto.barcode;
    if (dto.searchTerms !== undefined) {
      product.searchTerms = ProductsService.toSearchTerms(dto.searchTerms);
    }
    if (dto.isActive !== undefined) product.isActive = dto.isActive;
    if (dto.isFeatured !== undefined) product.isFeatured = dto.isFeatured;

    // `null` is a deliberate instruction to clear the discount, which is why it
    // is handled separately from `undefined`. The schema rejects a fake one.
    if (dto.compareAtPrice !== undefined) product.compareAtPrice = dto.compareAtPrice ?? null;

    try {
      await product.save();
    } catch (error) {
      throw this.translateDuplicateKey(error);
    }

    return this.findOneOrFail(product._id.toString(), { includeInactive: true });
  }

  async setActive(id: string, isActive: boolean): Promise<ProductDetailView> {
    const storeId = await this.storesService.getActiveStoreObjectId();

    const product = await this.productModel
      .findOneAndUpdate({ _id: id, storeId }, { $set: { isActive } }, { new: true })
      .exec();

    if (!product) throw new NotFoundException('Product not found');

    return this.findOneOrFail(product._id.toString(), { includeInactive: true });
  }

  /**
   * Deletion is refused whenever it would break something a shopper is in the
   * middle of. Favourites and the stock row are per-store/per-user data with no
   * historical value, so they are cleaned up with the product.
   *
   * Once orders exist, an order reference joins this guard — an ordered product
   * must remain readable forever, and deactivation is the only correct action.
   */
  async remove(id: string): Promise<{ deleted: true; id: string }> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const product = await this.productModel.findOne({ _id: id, storeId }).exec();

    if (!product) throw new NotFoundException('Product not found');

    const inCart = await this.cartModel.exists({ 'items.productId': product._id });

    if (inCart) {
      throw new ConflictException(
        'This product is in a shopper’s cart and cannot be deleted. Deactivate it instead — it will disappear from the catalogue immediately.',
      );
    }

    await Promise.all([
      this.favoriteModel.deleteMany({ productId: product._id }).exec(),
      this.inventoryService.removeForProduct(product._id, storeId),
    ]);

    await product.deleteOne();
    this.logger.log('Product deleted: ' + product.sku);

    return { deleted: true, id: product._id.toString() };
  }

  // --- Query construction -------------------------------------------------

  private async buildMatch(
    query: QueryProductsDto,
    storeId: Types.ObjectId,
    includeInactive: boolean,
  ): Promise<FilterQuery<ProductDocument>> {
    const match: FilterQuery<ProductDocument> = { storeId };
    const and: FilterQuery<ProductDocument>[] = [];

    if (!includeInactive) match.isActive = true;
    if (query.featured) match.isFeatured = true;

    // A non-null compareAtPrice is guaranteed by the schema to exceed the
    // selling price, so its presence alone is a genuine discount.
    if (query.discounted) match.compareAtPrice = { $ne: null };

    if (query.brand) {
      match.brand = new RegExp('^' + escapeRegExp(query.brand) + '$', 'i');
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      if (
        query.minPrice !== undefined &&
        query.maxPrice !== undefined &&
        query.minPrice > query.maxPrice
      ) {
        throw new BadRequestException('minPrice cannot be greater than maxPrice');
      }

      match.sellingPrice = {
        ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
      };
    }

    if (query.category) {
      const ids = await this.categoriesService.resolveFilterIds(query.category, storeId);
      // An unknown or inactive category must return nothing, not everything.
      if (ids.length === 0) return { _id: { $in: [] } };
      and.push({ $or: [{ categoryId: { $in: ids } }, { subcategoryId: { $in: ids } }] });
    }

    if (query.subcategory) {
      const ids = await this.categoriesService.resolveFilterIds(query.subcategory, storeId);
      if (ids.length === 0) return { _id: { $in: [] } };
      and.push({ subcategoryId: { $in: ids } });
    }

    if (query.search) {
      and.push(this.buildSearchClause(query.search));
    }

    if (and.length > 0) match.$and = and;

    return match;
  }

  /**
   * Word-prefix matching across name, brand and the alias list, plus an exact
   * SKU/barcode hit.
   *
   * Prefix rather than whole-word because shoppers search as they type — "mil"
   * must find "Olper's Milk". `searchTerms` is what makes Urdu and Roman-Urdu
   * queries work today ("doodh") and is the field a real search engine would
   * index later without changing this contract.
   */
  private buildSearchClause(term: string): FilterQuery<ProductDocument> {
    const escaped = escapeRegExp(term);
    const prefix = new RegExp('(^|\\s|-)' + escaped, 'i');
    const exact = term.toUpperCase();

    return {
      $or: [
        { name: prefix },
        { brand: prefix },
        { searchTerms: prefix },
        { sku: exact },
        { barcode: term },
      ],
    };
  }

  private buildSort(query: QueryProductsDto): {
    sort: Record<string, 1 | -1>;
    addFields?: Record<string, unknown>;
  } {
    switch (query.sort) {
      case ProductSort.PRICE_ASC:
        return { sort: { sellingPrice: 1, _id: 1 } };

      case ProductSort.PRICE_DESC:
        return { sort: { sellingPrice: -1, _id: 1 } };

      case ProductSort.NEWEST:
        return { sort: { createdAt: -1, _id: 1 } };

      case ProductSort.NAME_ASC:
        return { sort: { name: 1, _id: 1 } };

      case ProductSort.DISCOUNT:
        // Sorting by the price ratio is order-equivalent to sorting by discount
        // percentage, and avoids restating the percentage formula in the
        // pipeline — `discountPercent()` stays the only definition of it.
        return {
          sort: { priceRatio: 1, _id: 1 },
          addFields: {
            priceRatio: {
              $cond: [
                { $gt: ['$compareAtPrice', 0] },
                { $divide: ['$sellingPrice', '$compareAtPrice'] },
                1,
              ],
            },
          },
        };

      case ProductSort.RELEVANCE:
      default:
        // Without a search term "relevance" has nothing to rank by, so fall
        // back to the merchandised order rather than pretending to score.
        if (!query.search) {
          return { sort: { isFeatured: -1, createdAt: -1, _id: 1 } };
        }

        return {
          sort: { relevance: -1, isFeatured: -1, createdAt: -1, _id: 1 },
          addFields: {
            relevance: this.relevanceExpression(query.search),
          },
        };
    }
  }

  /** A name hit beats a brand hit; a name that starts with the term beats both. */
  private relevanceExpression(term: string): Record<string, unknown> {
    const escaped = escapeRegExp(term);

    return {
      $switch: {
        branches: [
          {
            case: { $regexMatch: { input: '$name', regex: '^' + escaped, options: 'i' } },
            then: 3,
          },
          {
            case: { $regexMatch: { input: '$name', regex: escaped, options: 'i' } },
            then: 2,
          },
          {
            case: {
              $regexMatch: {
                input: { $ifNull: ['$brand', ''] },
                regex: escaped,
                options: 'i',
              },
            },
            then: 1,
          },
        ],
        default: 0,
      },
    };
  }

  /**
   * Runs the catalogue pipeline.
   *
   * The stock join is placed as late as possible: only an `inStock` filter needs
   * it before paging, so ordinary browsing joins 20 rows instead of the whole
   * matched set.
   */
  private async runQuery(params: {
    storeId: Types.ObjectId;
    match: FilterQuery<ProductDocument>;
    sort: Record<string, 1 | -1>;
    addFields?: Record<string, unknown>;
    requireInStock?: boolean;
    skip: number;
    limit: number;
    countTotal: boolean;
  }): Promise<{ items: ProductView[]; total: number }> {
    const stockLookup: PipelineStage[] = [
      {
        $lookup: {
          from: INVENTORY_COLLECTION,
          let: { productId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$productId', '$$productId'] },
                    { $eq: ['$storeId', params.storeId] },
                  ],
                },
              },
            },
            { $project: { _id: 0, quantity: 1, lowStockThreshold: 1 } },
          ],
          as: 'stockRow',
        },
      },
    ];

    const pipeline: PipelineStage[] = [{ $match: params.match }];

    if (params.addFields) pipeline.push({ $addFields: params.addFields });

    if (params.requireInStock) {
      pipeline.push(...stockLookup, {
        $match: { 'stockRow.0.quantity': { $gt: 0 } },
      });
    }

    const itemsBranch: PipelineStage.FacetPipelineStage[] = [
      { $sort: params.sort },
      { $skip: params.skip },
      { $limit: params.limit },
    ];

    if (!params.requireInStock) {
      itemsBranch.push(...(stockLookup as PipelineStage.FacetPipelineStage[]));
    }

    pipeline.push({
      $facet: {
        items: itemsBranch,
        ...(params.countTotal ? { total: [{ $count: 'value' }] } : {}),
      },
    });

    const [result] = await this.productModel
      .aggregate<{ items: ProductWithStock[]; total?: Array<{ value: number }> }>(pipeline)
      .exec();

    const items = (result?.items ?? []).map((row) =>
      toProductView(row, InventoryService.toStockView(row.stockRow?.[0] ?? null)),
    );

    return { items, total: result?.total?.[0]?.value ?? items.length };
  }

  // --- Helpers ------------------------------------------------------------

  private resolve(idOrSlug: string, storeId: Types.ObjectId) {
    const filter: FilterQuery<ProductDocument> = Types.ObjectId.isValid(idOrSlug)
      ? { _id: new Types.ObjectId(idOrSlug), storeId }
      : { slug: idOrSlug.toLowerCase(), storeId };

    return this.productModel.findOne(filter).lean<LeanProduct>().exec();
  }

  /**
   * The subset of a creation payload that may reach the document. Anything not
   * listed — `slug`, `storeId`, category ids — is derived or validated
   * elsewhere and cannot be set by a client.
   */
  private creationFields(dto: CreateProductDto) {
    return {
      name: dto.name.trim(),
      description: dto.description,
      shortDescription: dto.shortDescription,
      brand: dto.brand?.trim(),
      images: ProductsService.toImages(dto.images ?? []),
      sellingPrice: dto.sellingPrice,
      compareAtPrice: dto.compareAtPrice ?? null,
      unitType: dto.unitType,
      unitValue: dto.unitValue,
      searchTerms: ProductsService.toSearchTerms(dto.searchTerms ?? []),
      barcode: dto.barcode,
      isActive: dto.isActive ?? true,
      isFeatured: dto.isFeatured ?? false,
    };
  }

  /** Images keep their given order when no explicit sortOrder is supplied. */
  private static toImages(images: NonNullable<CreateProductDto['images']>) {
    return images.map((image, index) => ({
      url: image.url,
      alt: image.alt,
      sortOrder: image.sortOrder ?? index,
    }));
  }

  /** Aliases are normalised so "Doodh" and "doodh" are the same search term. */
  private static toSearchTerms(terms: string[]): string[] {
    return terms.map((term) => term.trim().toLowerCase()).filter(Boolean);
  }

  private async resolveSlug(
    source: string,
    storeId: Types.ObjectId,
    excludeId?: Types.ObjectId,
  ): Promise<string> {
    if (!slugify(source)) {
      throw new BadRequestException('Product name must contain at least one letter or digit');
    }

    return uniqueSlug(source, async (candidate) => {
      const filter: FilterQuery<ProductDocument> = { slug: candidate, storeId };
      if (excludeId) filter._id = { $ne: excludeId };
      return (await this.productModel.exists(filter)) !== null;
    });
  }

  private async assertSkuAvailable(
    sku: string,
    storeId: Types.ObjectId,
    excludeId?: Types.ObjectId,
  ): Promise<void> {
    const filter: FilterQuery<ProductDocument> = { sku, storeId };
    if (excludeId) filter._id = { $ne: excludeId };

    if (await this.productModel.exists(filter)) {
      throw new ConflictException('SKU "' + sku + '" is already used by another product');
    }
  }

  /**
   * The unique indexes are the real authority — a check-then-write can always
   * lose a race, so the driver error is translated rather than trusted away.
   */
  private translateDuplicateKey(error: unknown): unknown {
    const code = (error as { code?: number }).code;
    if (code !== 11000) return error;

    const key = Object.keys((error as { keyPattern?: Record<string, unknown> }).keyPattern ?? {});

    if (key.includes('sku')) return new ConflictException('That SKU is already in use');
    if (key.includes('barcode')) return new ConflictException('That barcode is already in use');
    return new ConflictException('A product with these details already exists');
  }
}

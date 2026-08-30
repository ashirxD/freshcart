import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaginatedResult, paginated } from 'src/common/dto';
import { PaginationQueryDto } from 'src/common/dto';
import { ProductView, ProductsService } from 'src/modules/products';
import { StoresService } from 'src/modules/stores';
import { Favorite, FavoriteDocument } from './schemas';

/** Ceiling on the id set a product grid uses to render its hearts. */
const MAX_FAVORITE_IDS = 1000;

export interface FavoriteView {
  productId: string;
  addedAt: Date;
  /** Null when the product has since been removed from the catalogue. */
  product: ProductView | null;
}

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<FavoriteDocument>,
    private readonly productsService: ProductsService,
    private readonly storesService: StoresService,
  ) {}

  async list(userId: string, query: PaginationQueryDto): Promise<PaginatedResult<FavoriteView>> {
    const owner = new Types.ObjectId(userId);
    const storeId = await this.storesService.getActiveStoreObjectId();

    const [rows, total] = await Promise.all([
      this.favoriteModel
        .find({ userId: owner })
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .lean()
        .exec(),
      this.favoriteModel.countDocuments({ userId: owner }).exec(),
    ]);

    // One batch lookup for the page, not one query per favourite.
    const views = await this.productsService.findViewsByIds(
      rows.map((row) => row.productId),
      storeId,
    );

    const items: FavoriteView[] = rows.map((row) => ({
      productId: row.productId.toString(),
      addedAt: row.createdAt,
      // A deactivated product is still shown, marked unavailable by its own
      // `isActive` flag, rather than vanishing from the list without explanation.
      product: views.get(row.productId.toString()) ?? null,
    }));

    return paginated(items, total, { page: query.page, limit: query.limit });
  }

  /**
   * Adding is idempotent: the unique (userId, productId) index makes a duplicate
   * impossible, and the upsert makes a repeat tap a no-op rather than a 409.
   */
  async add(userId: string, productId: string): Promise<{ productId: string; isFavorite: true }> {
    const storeId = await this.storesService.getActiveStoreObjectId();

    // Confirms the product exists in this store before saving a dangling id.
    // Deliberately not `findPurchasableOrFail`: saving something that is
    // temporarily out of stock or deactivated is a legitimate thing to want.
    await this.assertProductExists(productId, storeId);

    await this.favoriteModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId), productId: new Types.ObjectId(productId) },
        { $setOnInsert: { createdAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    return { productId, isFavorite: true };
  }

  /** Also idempotent — removing something already gone is a success, not a 404. */
  async remove(
    userId: string,
    productId: string,
  ): Promise<{ productId: string; isFavorite: false }> {
    await this.favoriteModel
      .deleteOne({
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(productId),
      })
      .exec();

    return { productId, isFavorite: false };
  }

  /**
   * The ids the signed-in shopper has favourited, so a product grid can render
   * filled hearts from one small response instead of a request per card.
   *
   * Capped rather than unbounded: this is a projection over an indexed field,
   * but no query should be able to grow without limit. Past the cap a heart
   * renders empty until the shopper taps it, and adding is idempotent, so the
   * worst case is a redundant write rather than lost data.
   */
  async listIds(userId: string): Promise<string[]> {
    const rows = await this.favoriteModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(MAX_FAVORITE_IDS)
      .select('productId')
      .lean()
      .exec();

    return rows.map((row) => row.productId.toString());
  }

  private async assertProductExists(productId: string, storeId: Types.ObjectId): Promise<void> {
    const views = await this.productsService.findViewsByIds(
      [new Types.ObjectId(productId)],
      storeId,
    );

    if (!views.has(productId)) throw new NotFoundException('Product not found');
  }
}

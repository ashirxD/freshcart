import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StockStatus } from 'src/common/enums';
import { ProductView, ProductsService } from 'src/modules/products';
import { StoresService } from 'src/modules/stores';
import { AddCartItemDto, UpdateCartItemDto } from './dto';
import { Cart, CartDocument, MAX_CART_ITEMS } from './schemas';

/** Why a line cannot be bought right now. `null` means it is fine. */
export type CartItemIssue = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'QUANTITY_REDUCED';

export interface CartItemView {
  productId: string;
  quantity: number;
  /** Server-computed: unit price times quantity, in whole rupees. */
  lineTotal: number;
  addedAt: Date;
  /** Null when the product has been deleted from the catalogue outright. */
  product: ProductView | null;
  /**
   * Set when the line needs the shopper's attention — the product was
   * deactivated, sold out, or the quantity had to be capped to available stock.
   */
  issue: CartItemIssue | null;
  /** Stock ceiling for this line, so the UI can disable "+" at the right point. */
  maxQuantity: number;
}

export interface CartView {
  id: string | null;
  items: CartItemView[];
  /** Number of distinct products. */
  itemCount: number;
  /** Total units across all lines — what the navigation badge shows. */
  totalQuantity: number;
  /**
   * Sum of purchasable lines only, in whole rupees. Lines flagged with an issue
   * are excluded, so the figure always matches what would actually be charged.
   */
  subtotal: number;
  /** True when any line needs attention before checkout. */
  hasIssues: boolean;
  updatedAt: Date | null;
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    private readonly productsService: ProductsService,
    private readonly storesService: StoresService,
  ) {}

  /**
   * Every read rebuilds the cart from the current catalogue: prices, stock and
   * availability are whatever they are *now*, not what they were when the item
   * was added. That is what makes a stored subtotal unnecessary — and a
   * client-supplied one meaningless.
   */
  async getCart(userId: string): Promise<CartView> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const cart = await this.cartModel
      .findOne({ userId: new Types.ObjectId(userId), storeId })
      .exec();

    return this.present(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartView> {
    const storeId = await this.storesService.getActiveStoreObjectId();

    // 1-3. The product must exist, be active, and belong to this store. All
    // three are enforced by the authoritative lookup, which scopes by storeId.
    const { product, stock } = await this.productsService.findPurchasableOrFail(
      dto.productId,
      storeId,
    );

    const cart = await this.loadOrCreate(userId, storeId);
    const existing = cart.items.find((item) => item.productId.equals(product._id));
    const requested = (existing?.quantity ?? 0) + dto.quantity;

    // 4-5. Availability is checked against the *resulting* quantity, not the
    // increment, so repeated "add one" taps cannot walk past the stock level.
    this.assertStockCovers(product.name, requested, stock.quantity);

    if (!existing && cart.items.length >= MAX_CART_ITEMS) {
      throw new BadRequestException(
        'A cart can hold up to ' + MAX_CART_ITEMS + ' different products',
      );
    }

    if (existing) {
      existing.quantity = requested;
    } else {
      cart.items.push({ productId: product._id, quantity: dto.quantity, addedAt: new Date() });
    }

    await cart.save();
    return this.present(cart);
  }

  async updateItem(userId: string, productId: string, dto: UpdateCartItemDto): Promise<CartView> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const cart = await this.loadOwnCartOrFail(userId, storeId);

    const item = cart.items.find((entry) => entry.productId.equals(new Types.ObjectId(productId)));
    if (!item) throw new NotFoundException('That product is not in your cart');

    const { product, stock } = await this.productsService.findPurchasableOrFail(productId, storeId);
    this.assertStockCovers(product.name, dto.quantity, stock.quantity);

    item.quantity = dto.quantity;
    await cart.save();

    return this.present(cart);
  }

  async removeItem(userId: string, productId: string): Promise<CartView> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const cart = await this.loadOwnCartOrFail(userId, storeId);

    const before = cart.items.length;
    cart.items = cart.items.filter((item) => !item.productId.equals(new Types.ObjectId(productId)));

    if (cart.items.length === before) {
      throw new NotFoundException('That product is not in your cart');
    }

    await cart.save();
    return this.present(cart);
  }

  async clear(userId: string): Promise<CartView> {
    const storeId = await this.storesService.getActiveStoreObjectId();

    // Scoped by userId in the filter itself: there is no code path here that
    // could be pointed at another shopper's cart.
    const cart = await this.cartModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId), storeId },
        { $set: { items: [] } },
        { new: true },
      )
      .exec();

    return this.present(cart);
  }

  /**
   * Assembles the response from authoritative catalogue data in a single batch
   * lookup — one query for the products, one for their stock, regardless of how
   * many lines the cart has.
   */
  private async present(cart: CartDocument | null): Promise<CartView> {
    if (!cart || cart.items.length === 0) {
      return {
        id: cart?._id.toString() ?? null,
        items: [],
        itemCount: 0,
        totalQuantity: 0,
        subtotal: 0,
        hasIssues: false,
        updatedAt: cart?.updatedAt ?? null,
      };
    }

    const productIds = cart.items.map((item) => item.productId);
    const views = await this.productsService.findViewsByIds(productIds, cart.storeId);

    const items: CartItemView[] = cart.items.map((item) => {
      const product = views.get(item.productId.toString()) ?? null;
      const available = product?.stock.quantity ?? 0;

      const issue: CartItemIssue | null =
        !product || !product.isActive
          ? 'UNAVAILABLE'
          : product.stock.status === StockStatus.OUT_OF_STOCK
            ? 'OUT_OF_STOCK'
            : item.quantity > available
              ? 'QUANTITY_REDUCED'
              : null;

      return {
        productId: item.productId.toString(),
        quantity: item.quantity,
        // Only a line that can actually be bought contributes money.
        lineTotal: issue === null && product ? product.sellingPrice * item.quantity : 0,
        addedAt: item.addedAt,
        product,
        issue,
        maxQuantity: available,
      };
    });

    return {
      id: cart._id.toString(),
      items,
      itemCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      // Integer rupees throughout, so this addition is exact.
      subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
      hasIssues: items.some((item) => item.issue !== null),
      updatedAt: cart.updatedAt,
    };
  }

  private assertStockCovers(productName: string, requested: number, available: number): void {
    if (available <= 0) {
      throw new ConflictException('"' + productName + '" is out of stock');
    }

    if (requested > available) {
      throw new ConflictException(
        'Only ' +
          available +
          ' of "' +
          productName +
          '" ' +
          (available === 1 ? 'is' : 'are') +
          ' left',
      );
    }
  }

  private async loadOrCreate(userId: string, storeId: Types.ObjectId): Promise<CartDocument> {
    const owner = new Types.ObjectId(userId);

    // Upsert rather than find-then-create: the unique (userId, storeId) index
    // would otherwise reject a second cart when two tabs add at once.
    return this.cartModel
      .findOneAndUpdate(
        { userId: owner, storeId },
        { $setOnInsert: { userId: owner, storeId, items: [] } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  private async loadOwnCartOrFail(userId: string, storeId: Types.ObjectId): Promise<CartDocument> {
    const cart = await this.cartModel
      .findOne({ userId: new Types.ObjectId(userId), storeId })
      .exec();

    if (!cart) throw new NotFoundException('Your cart is empty');
    return cart;
  }
}

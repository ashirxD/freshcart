import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { StockStatus } from 'src/common/enums';
import { ProductView, ProductsService } from 'src/modules/products';
import { StoresService } from 'src/modules/stores';
import { AddCartItemDto, UpdateCartItemDto } from './dto';
import { Cart, CartDocument, MAX_CART_ITEMS } from './schemas';

/** Why a line cannot be bought right now. `null` means it is fine. */
export type CartItemIssue = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'QUANTITY_REDUCED';

/** Why a bulk addition could not include a particular product. */
export type CartAdditionFailureReason =
  'PRODUCT_NOT_FOUND' | 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK' | 'CART_FULL';

export interface CartAdditionFailure {
  productId: string;
  /** Null when the product is not in the catalogue at all. */
  productName: string | null;
  requestedQuantity: number;
  reason: CartAdditionFailureReason;
  /** Present for INSUFFICIENT_STOCK and OUT_OF_STOCK. */
  availableQuantity?: number;
}

export interface CartAdditionResult {
  cart: CartView;
  added: Array<{ productId: string; productName: string; quantity: number }>;
  failed: CartAdditionFailure[];
}

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
      // Re-agreeing to the line re-agrees to today's price.
      existing.unitPriceSnapshot = product.sellingPrice;
    } else {
      cart.items.push({
        productId: product._id,
        quantity: dto.quantity,
        unitPriceSnapshot: product.sellingPrice,
        addedAt: new Date(),
      });
    }

    await cart.save();
    return this.present(cart);
  }

  /**
   * Adds several products at once, reporting per-product outcomes.
   *
   * This exists for the grocery-list scanner, which confirms a whole list in
   * one action, and it is a method on THIS service rather than a second
   * implementation somewhere else (§30). Every rule `addItem` applies applies
   * here — the product must exist, be active, belong to this store, and have
   * the stock to cover the resulting quantity — and quantities accumulate onto
   * an existing line exactly as they do for a single add (§32).
   *
   * PARTIAL SUCCESS IS THE POINT (§31, §62)
   *
   * One sold-out item must not cost the shopper the other seven. So a line that
   * cannot be added is reported, not thrown, and the caller shows both lists.
   * The alternative — all or nothing — would mean a shopper photographing a
   * ten-item list and getting nothing because the eggs ran out.
   *
   * Costs four queries regardless of how many products are added: one for the
   * store, two for the batch catalogue read, one to save (§68).
   */
  async addItems(
    userId: string,
    requested: Array<{ productId: string; quantity: number }>,
  ): Promise<CartAdditionResult> {
    const storeId = await this.storesService.getActiveStoreObjectId();

    // The same product listed twice in one request is one line with the
    // quantities summed, which is what the cart would have done anyway had the
    // two additions arrived separately.
    const merged = new Map<string, number>();
    for (const line of requested) {
      merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantity);
    }

    const productIds = [...merged.keys()].map((id) => new Types.ObjectId(id));

    // Authoritative catalogue read. Prices, availability and stock come from
    // here and only from here — never from whatever the client sent (§34, §61).
    const views = await this.productsService.findViewsByIds(productIds, storeId);
    const cart = await this.loadOrCreate(userId, storeId);

    const added: CartAdditionResult['added'] = [];
    const failed: CartAdditionFailure[] = [];

    for (const [productId, quantity] of merged) {
      const product = views.get(productId);

      if (!product) {
        // Scoped by storeId in the query above, so a product from another
        // store is indistinguishable from one that does not exist (§55).
        failed.push({
          productId,
          productName: null,
          requestedQuantity: quantity,
          reason: 'PRODUCT_NOT_FOUND',
        });
        continue;
      }

      if (!product.isActive) {
        failed.push({
          productId,
          productName: product.name,
          requestedQuantity: quantity,
          reason: 'UNAVAILABLE',
        });
        continue;
      }

      const existing = cart.items.find((item) => item.productId.equals(product.id));
      const resulting = (existing?.quantity ?? 0) + quantity;
      const available = product.stock.quantity;

      if (available <= 0) {
        failed.push({
          productId,
          productName: product.name,
          requestedQuantity: quantity,
          reason: 'OUT_OF_STOCK',
          availableQuantity: 0,
        });
        continue;
      }

      if (resulting > available) {
        // §33: the shopper is told how many there actually are, so they can
        // choose a smaller quantity rather than being told only "no".
        failed.push({
          productId,
          productName: product.name,
          requestedQuantity: quantity,
          reason: 'INSUFFICIENT_STOCK',
          availableQuantity: available,
        });
        continue;
      }

      if (!existing && cart.items.length >= MAX_CART_ITEMS) {
        failed.push({
          productId,
          productName: product.name,
          requestedQuantity: quantity,
          reason: 'CART_FULL',
        });
        continue;
      }

      if (existing) {
        existing.quantity = resulting;
        existing.unitPriceSnapshot = product.sellingPrice;
      } else {
        cart.items.push({
          productId: new Types.ObjectId(product.id),
          quantity,
          unitPriceSnapshot: product.sellingPrice,
          addedAt: new Date(),
        });
      }

      added.push({ productId, productName: product.name, quantity });
    }

    if (added.length > 0) await cart.save();

    return { cart: await this.present(cart), added, failed };
  }

  async updateItem(userId: string, productId: string, dto: UpdateCartItemDto): Promise<CartView> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const cart = await this.loadOwnCartOrFail(userId, storeId);

    const item = cart.items.find((entry) => entry.productId.equals(new Types.ObjectId(productId)));
    if (!item) throw new NotFoundException('That product is not in your cart');

    const { product, stock } = await this.productsService.findPurchasableOrFail(productId, storeId);
    this.assertStockCovers(product.name, dto.quantity, stock.quantity);

    item.quantity = dto.quantity;
    item.unitPriceSnapshot = product.sellingPrice;
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

  // --- Checkout collaboration --------------------------------------------
  // Checkout needs the cart as *stored* — product ids, quantities and the
  // agreed prices — not the presented view, because it re-reads the catalogue
  // itself and must not build an order on a second-hand copy of it.

  /** The raw cart for this shopper at the active store, or null if they have none. */
  async findOwnCart(userId: string, storeId: Types.ObjectId): Promise<CartDocument | null> {
    return this.cartModel.findOne({ userId: new Types.ObjectId(userId), storeId }).exec();
  }

  /**
   * Removes the lines that have just been turned into an order, leaving
   * anything else untouched.
   *
   * FreshCarts checks out the whole cart, so in practice this empties it — but
   * the operation is expressed as "remove exactly these products" rather than
   * "clear", because a `$set: { items: [] }` would silently discard a line the
   * shopper added in another tab while the order was being placed.
   *
   * Called only after the order is safely written (§13). It takes the session
   * so it joins the order's unit of work where transactions are available.
   */
  async removePurchasedItems(
    userId: string,
    storeId: Types.ObjectId,
    productIds: Types.ObjectId[],
    session: ClientSession | null = null,
  ): Promise<void> {
    if (productIds.length === 0) return;

    await this.cartModel
      .updateOne(
        { userId: new Types.ObjectId(userId), storeId },
        { $pull: { items: { productId: { $in: productIds } } } },
        { session: session ?? undefined },
      )
      .exec();
  }

  /**
   * Records that the shopper has seen and accepted the current prices.
   *
   * This is the "yes, I have looked at the new prices" step §46 requires. It
   * only ever copies live catalogue prices onto the agreed-price field — it
   * cannot set an arbitrary price, and it changes nothing about what is charged.
   */
  async acceptCurrentPrices(userId: string): Promise<CartView> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const cart = await this.loadOwnCartOrFail(userId, storeId);

    const views = await this.productsService.findViewsByIds(
      cart.items.map((item) => item.productId),
      storeId,
    );

    for (const item of cart.items) {
      const product = views.get(item.productId.toString());
      if (product) item.unitPriceSnapshot = product.sellingPrice;
    }

    await cart.save();
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

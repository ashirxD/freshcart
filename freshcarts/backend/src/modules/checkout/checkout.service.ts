import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { BusinessException } from 'src/common/errors';
import { lineTotal, orderTotal, sumMoney } from 'src/common/utils';
import { AddressesService, LeanAddress, formatAddress } from 'src/modules/addresses';
import { CartService } from 'src/modules/cart/cart.service';
import { DeliveryService } from 'src/modules/delivery';
import { FulfillmentMethod } from 'src/modules/orders/order-status.machine';
import { PaymentMethod } from 'src/modules/payments/enums';
import { PaymentsService } from 'src/modules/payments';
import { ProductView, ProductsService } from 'src/modules/products';
import { StoreDocument, StoresService } from 'src/modules/stores';
import {
  CheckoutDraft,
  CheckoutIssue,
  CheckoutLine,
  CheckoutPreviewView,
  PickupDetails,
} from './checkout.types';
import { CheckoutPreviewDto } from './dto';

/**
 * CHECKOUT
 * ========
 *
 * Turning a cart into an order is not a data transformation, and this service
 * exists so that it is never written as one. A cart is a list of intentions
 * recorded at some point in the past; an order is a binding, priced commitment
 * made now. Between the two sits a re-read of every fact the price depends on.
 *
 * The pipeline, in order — each step meaningful only if the previous passed:
 *
 *   store open?  ->  cart non-empty?  ->  every product re-read from the
 *   catalogue  ->  active, in stock, price unchanged?  ->  fulfilment valid
 *   (address owned and geocoded, within the service area)  ->  distance
 *   measured  ->  fee priced  ->  totals summed  ->  payment method enabled
 *
 * Nothing the client sent contributes a number. The request names a fulfilment
 * method, an address id and a payment method; every price, quantity ceiling,
 * distance and total in the result is read or computed here.
 *
 * `validate()` is called twice per order — once for the preview the shopper
 * reviews, once again inside order creation. The second call is not a
 * formality: stock and prices move between the two, and treating the preview as
 * still-valid is exactly the assumption §32 forbids.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly cartService: CartService,
    private readonly productsService: ProductsService,
    private readonly addressesService: AddressesService,
    private readonly deliveryService: DeliveryService,
    private readonly paymentsService: PaymentsService,
    private readonly storesService: StoresService,
  ) {}

  /** The server-authoritative preview, shaped for the API boundary. */
  async preview(userId: string, dto: CheckoutPreviewDto): Promise<CheckoutPreviewView> {
    const draft = await this.validate(userId, dto);
    return CheckoutService.toPreviewView(draft, await this.deliveryService.maxDistanceMeters());
  }

  /**
   * Builds a validated, priced draft — or throws with everything the shopper
   * needs to fix the problem.
   */
  async validate(
    userId: string,
    dto: CheckoutPreviewDto & { paymentMethod?: PaymentMethod },
  ): Promise<CheckoutDraft> {
    // 1. The store must be able to take the order at all.
    const store = await this.storesService.assertAcceptingOrders();
    const storeId = store._id;

    // 2. The cart must exist and have something in it.
    const cart = await this.cartService.findOwnCart(userId, storeId);

    if (!cart || cart.items.length === 0) throw BusinessException.cartEmpty();

    // 3-5. Re-read every product from the catalogue and check it against what
    // the shopper agreed to. One batch lookup, regardless of basket size.
    const views = await this.productsService.findViewsByIds(
      cart.items.map((item) => item.productId),
      storeId,
    );

    const issues: CheckoutIssue[] = [];
    const lines: CheckoutLine[] = [];

    for (const item of cart.items) {
      const product = views.get(item.productId.toString()) ?? null;
      const issue = CheckoutService.inspectLine(item, product);

      if (issue) {
        issues.push(issue);
        continue;
      }

      // `inspectLine` returning null guarantees a usable product.
      lines.push(CheckoutService.toLine(item, product as ProductView));
    }

    if (issues.length > 0) throw CheckoutService.rejectWithIssues(issues);

    // 6. Money. Integers only, and one definition of the sum.
    const subtotal = sumMoney(lines.map((line) => line.lineTotal));

    // 7. Fulfilment: address, distance and fee, or the store's pickup details.
    const fulfilment = await this.resolveFulfilment(userId, storeId, store, dto);

    // 8. Payment. Enum membership is not permission — the configured set is.
    const availablePaymentMethods = this.paymentsService.availableMethods();

    if (dto.paymentMethod) this.paymentsService.assertMethodIsAvailable(dto.paymentMethod);

    return {
      storeId,
      fulfillmentMethod: dto.fulfillmentMethod,
      lines,
      subtotal,
      deliveryFee: fulfilment.deliveryFee,
      discount: 0,
      total: orderTotal({ subtotal, deliveryFee: fulfilment.deliveryFee, discount: 0 }),
      currency: 'PKR',
      address: fulfilment.address,
      delivery: fulfilment.delivery,
      pickup: fulfilment.pickup,
      paymentMethod: dto.paymentMethod ?? null,
      availablePaymentMethods,
    };
  }

  // --- Line validation ----------------------------------------------------

  /**
   * Everything that can be wrong with one line, in the order a shopper would
   * care about it. Returns null when the line is fine.
   *
   * Pure and static so each rule is directly testable without a cart, a
   * database or a store.
   */
  static inspectLine(
    item: { productId: Types.ObjectId; quantity: number; unitPriceSnapshot: number | null },
    product: ProductView | null,
  ): CheckoutIssue | null {
    const productId = item.productId.toString();

    // Gone from the catalogue entirely.
    if (!product) {
      return {
        code: 'PRODUCT_REMOVED',
        productId,
        productName: 'This product',
        message:
          'One of the items in your cart is no longer sold. Please remove it before placing the order.',
      };
    }

    if (!product.isActive) {
      return {
        code: 'PRODUCT_UNAVAILABLE',
        productId,
        productName: product.name,
        message:
          product.name +
          ' is no longer available. Please remove it from your cart before placing the order.',
      };
    }

    if (product.stock.quantity <= 0) {
      return {
        code: 'OUT_OF_STOCK',
        productId,
        productName: product.name,
        message: product.name + ' has just sold out. Please remove it to continue.',
        availableQuantity: 0,
        requestedQuantity: item.quantity,
      };
    }

    if (item.quantity > product.stock.quantity) {
      return {
        code: 'INSUFFICIENT_STOCK',
        productId,
        productName: product.name,
        message:
          'Only ' +
          product.stock.quantity +
          ' of ' +
          product.name +
          ' ' +
          (product.stock.quantity === 1 ? 'is' : 'are') +
          ' available now. Please lower the quantity.',
        availableQuantity: product.stock.quantity,
        requestedQuantity: item.quantity,
      };
    }

    // A price move is not a blocker forever — it is a blocker until the shopper
    // has seen it. Lines added before the agreed-price field existed carry null
    // and make no claim, so they cannot raise a false alarm.
    if (
      item.unitPriceSnapshot !== null &&
      item.unitPriceSnapshot !== undefined &&
      item.unitPriceSnapshot !== product.sellingPrice
    ) {
      return {
        code: 'PRICE_CHANGED',
        productId,
        productName: product.name,
        message:
          'The price of ' +
          product.name +
          ' changed from Rs. ' +
          item.unitPriceSnapshot +
          ' to Rs. ' +
          product.sellingPrice +
          '.',
        previousPrice: item.unitPriceSnapshot,
        currentPrice: product.sellingPrice,
      };
    }

    return null;
  }

  /** Builds the priced line. Every value comes from the catalogue view. */
  private static toLine(
    item: { productId: Types.ObjectId; quantity: number },
    product: ProductView,
  ): CheckoutLine {
    return {
      productId: item.productId,
      productName: product.name,
      productImage: product.primaryImage?.url ?? null,
      brand: product.brand ?? null,
      sku: product.sku,
      unitLabel: product.unitLabel,
      unitType: product.unitType,
      unitValue: product.unitValue,
      quantity: item.quantity,
      unitPrice: product.sellingPrice,
      lineTotal: lineTotal(product.sellingPrice, item.quantity),
    };
  }

  /**
   * Turns line problems into one refusal.
   *
   * A price change alone is a different message from a stock problem, because
   * the shopper's next action is different: one is "review and accept", the
   * other is "change your cart".
   */
  private static rejectWithIssues(issues: CheckoutIssue[]): BusinessException {
    const onlyPriceChanges = issues.every((issue) => issue.code === 'PRICE_CHANGED');

    const message = onlyPriceChanges
      ? 'Some prices changed since you added these items. Please review them before placing your order.'
      : issues[0].message;

    return BusinessException.checkoutValidationFailed(message, {
      issues,
      // Lets the client pick the right screen without re-deriving it from the list.
      requiresPriceAcceptance: onlyPriceChanges,
    });
  }

  // --- Fulfilment ---------------------------------------------------------

  private async resolveFulfilment(
    userId: string,
    storeId: Types.ObjectId,
    store: StoreDocument,
    dto: CheckoutPreviewDto,
  ): Promise<{
    deliveryFee: number;
    address: LeanAddress | null;
    delivery: CheckoutDraft['delivery'];
    pickup: PickupDetails | null;
  }> {
    if (dto.fulfillmentMethod === FulfillmentMethod.PICKUP) {
      return {
        deliveryFee: 0,
        address: null,
        delivery: null,
        pickup: CheckoutService.toPickupDetails(store),
      };
    }

    if (!dto.addressId) throw BusinessException.invalidAddress('Choose a delivery address');

    // Ownership is enforced inside the lookup: an address id belonging to
    // another shopper resolves to "not found", never to a delivery quote.
    const address = await this.addressesService.findOwnedOrFail(userId, dto.addressId);

    if (address.latitude === null || address.longitude === null) {
      throw BusinessException.addressCoordinatesRequired();
    }

    const [storeLongitude, storeLatitude] = store.location.coordinates;

    const quote = await this.deliveryService.quote({
      storeId,
      origin: { latitude: storeLatitude, longitude: storeLongitude },
      destination: { latitude: address.latitude, longitude: address.longitude },
    });

    return { deliveryFee: quote.fee, address, delivery: quote, pickup: null };
  }

  /** The store facts a pickup order shows and snapshots. */
  private static toPickupDetails(store: StoreDocument): PickupDetails {
    const address = store.address;
    const [longitude, latitude] = store.location?.coordinates ?? [null, null];

    return {
      storeName: store.name,
      storeAddress: [address.line1, address.line2, address.area, address.city]
        .filter(Boolean)
        .join(', '),
      storePhone: store.phone,
      latitude: typeof latitude === 'number' ? latitude : null,
      longitude: typeof longitude === 'number' ? longitude : null,
      instructions: 'Please bring your order number. Orders are held for 24 hours.',
    };
  }

  // --- Presentation -------------------------------------------------------

  /** Maps the internal draft to the public preview. No ObjectIds, no internals. */
  static toPreviewView(draft: CheckoutDraft, maxDistanceMeters: number): CheckoutPreviewView {
    return {
      fulfillmentMethod: draft.fulfillmentMethod,
      items: draft.lines.map((line) => ({
        productId: line.productId.toString(),
        productName: line.productName,
        productImage: line.productImage,
        brand: line.brand,
        unitLabel: line.unitLabel,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      })),
      itemCount: draft.lines.length,
      totalQuantity: draft.lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotal: draft.subtotal,
      deliveryFee: draft.deliveryFee,
      discount: draft.discount,
      total: draft.total,
      currency: draft.currency,
      delivery:
        draft.delivery && draft.address
          ? {
              distanceMeters: draft.delivery.distanceMeters,
              durationSeconds: draft.delivery.durationSeconds,
              fee: draft.delivery.fee,
              maxDistanceMeters,
              address: {
                id: draft.address._id.toString(),
                label: draft.address.label,
                recipientName: draft.address.recipientName,
                phone: draft.address.phone,
                formatted: formatAddress(draft.address),
              },
            }
          : null,
      pickup: draft.pickup,
      paymentMethods: draft.availablePaymentMethods,
      selectedPaymentMethod: draft.paymentMethod,
    };
  }
}

/**
 * GROCERY LIST SCANNING
 * =====================
 *
 * Orchestrates the flagship flow:
 *
 *     photo -> AI service -> validated items -> catalogue matching -> review
 *                                                                       |
 *                                          shopper confirms <-----------+
 *                                                  |
 *                                                  v
 *                                          existing cart service
 *
 * Two operations, and the split between them is the whole design. Scanning
 * reads and suggests; it changes nothing. Confirming writes, and it re-reads
 * every product from the catalogue before it does — the scan result is a
 * suggestion the shopper reviewed, never an authority for what goes in a cart
 * (§29, §34, §60, §61).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AppConfig } from 'src/common/config/configuration';
import { CartService } from 'src/modules/cart/cart.service';
import { StoresService } from 'src/modules/stores';
import { AiOcrClient } from './ai/ai-ocr.client';
import type { ConfirmScanDto } from './dto/confirm-scan.dto';
import { ProductMatcherService } from './matching/product-matcher.service';
import { toScanResultView, type ScanConfirmationView, type ScanResultView } from './scan.view';
import { assertIsImage, safeFilename, type UploadedImage } from './upload/image-upload';

/** Shopper-facing wording for each reason the cart refused a product (§62). */
const FAILURE_MESSAGE: Record<string, (name: string | null, available?: number) => string> = {
  PRODUCT_NOT_FOUND: () => 'This product is no longer in our catalogue',
  UNAVAILABLE: (name) => (name ? name + ' is not available right now' : 'Not available right now'),
  OUT_OF_STOCK: (name) => (name ? name + ' is out of stock' : 'Out of stock'),
  INSUFFICIENT_STOCK: (_name, available) =>
    'Only ' + (available ?? 0) + ' ' + ((available ?? 0) === 1 ? 'is' : 'are') + ' available',
  CART_FULL: () => 'Your cart is already full',
};

@Injectable()
export class GroceryScanService {
  private readonly logger = new Logger(GroceryScanService.name);

  constructor(
    private readonly aiClient: AiOcrClient,
    private readonly matcher: ProductMatcherService,
    private readonly cartService: CartService,
    private readonly storesService: StoresService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Whether the scanner can be offered at all.
   *
   * Asked by the frontend before it shows the entry point, so a shopper is
   * never invited to photograph their list and only then told we cannot read
   * it. Everything else in FreshCarts is unaffected either way (§37).
   */
  async availability(): Promise<{ available: boolean }> {
    return { available: await this.aiClient.isHealthy() };
  }

  /**
   * Reads a photo of a grocery list and matches it against the catalogue.
   *
   * Nothing is written. The shopper reviews the result and confirms separately,
   * which is what §60 requires and what makes an uncertain match harmless.
   */
  async scan(userId: string, file: UploadedImage | undefined): Promise<ScanResultView> {
    const maxBytes = this.configService.get('scan', { infer: true }).maxImageBytes;

    // Validated here, in the process that would be compromised, on the bytes
    // rather than on anything the client claimed about them.
    const { buffer: image, contentType } = assertIsImage(file, maxBytes);

    // One id for the whole journey. Deliberately not the user id and not
    // derived from one: it goes into logs on both services, and a log line that
    // identifies a shopper is a log line that should not exist (§42, §72).
    const scanId = randomUUID();

    this.logger.log('Scan started [' + scanId + '] bytes=' + image.length + ' type=' + contentType);

    const [response, storeId] = await Promise.all([
      this.aiClient.readGroceryList({
        image,
        filename: safeFilename(contentType),
        contentType,
        requestId: scanId,
      }),
      this.storesService.getActiveStoreObjectId(),
    ]);

    const matches = await this.matcher.matchAll(response.items, storeId);
    const view = toScanResultView(scanId, response, matches);

    this.logger.log(
      'Scan matched [' +
        scanId +
        '] detected=' +
        view.summary.detected +
        ' matched=' +
        view.summary.matched +
        ' ambiguous=' +
        view.summary.ambiguous +
        ' notFound=' +
        view.summary.notFound,
    );

    return view;
  }

  /**
   * Adds the products the shopper confirmed to their existing cart.
   *
   * Everything the client sent is a product id and a quantity. Names, prices,
   * units and stock are re-read from the catalogue by the cart service, which
   * is also what enforces store scope, active status and stock — so a stale
   * scan, a tampered payload and a price change since the scan all end the same
   * way: the current truth wins (§29, §34, §61).
   *
   * Partial success is normal and is reported line by line (§31, §62).
   */
  async confirm(userId: string, dto: ConfirmScanDto): Promise<ScanConfirmationView> {
    const result = await this.cartService.addItems(userId, dto.items);

    this.logger.log(
      'Scan confirmed: added=' + result.added.length + ' failed=' + result.failed.length,
    );

    return {
      added: result.added,
      failed: result.failed.map((failure) => ({
        productId: failure.productId,
        productName: failure.productName,
        requestedQuantity: failure.requestedQuantity,
        reason:
          FAILURE_MESSAGE[failure.reason]?.(failure.productName, failure.availableQuantity) ??
          'Could not be added',
        availableQuantity: failure.availableQuantity,
      })),
      cart: result.cart,
    };
  }
}

/**
 * Customer endpoints for the grocery-list scanner (§69).
 *
 *   GET  /ocr/availability          Can the scanner be offered right now?
 *   POST /ocr/grocery-list          multipart image  -> detected items + matches
 *   POST /ocr/grocery-list/confirm  chosen product ids -> updated cart
 *
 * Authentication is not optional and not a formality: OCR is expensive, the
 * result is personal, and the confirm step writes to a cart. Every handler
 * takes its owner from the verified JWT principal, so there is no parameter a
 * client could change to act as somebody else (§40, §67).
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppConfig } from 'src/common/config/configuration';
import { CurrentUser, Roles } from 'src/common/decorators';
import { Role } from 'src/common/enums';
import { ConfirmScanDto } from './dto/confirm-scan.dto';
import { GroceryScanService } from './grocery-scan.service';
import { ScanRateLimitGuard } from './scan-rate-limit.guard';
import { scanUploadOptions, type UploadedImage } from './upload/image-upload';

/**
 * The upload ceiling used by the interceptor.
 *
 * Multer needs its limit when the route is *declared*, before configuration is
 * available, so this is the hard maximum the process will ever buffer.
 * SCAN_MAX_IMAGE_BYTES tightens it at runtime and is checked immediately after
 * — a configured 2 MB limit is enforced, this only stops anything absurd from
 * being read into memory at all.
 */
const ABSOLUTE_MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

@Controller('ocr')
@Roles(Role.CUSTOMER)
export class GroceryScanController {
  constructor(
    private readonly scanService: GroceryScanService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Whether scanning works right now.
   *
   * Cheap, unthrottled beyond the global limit, and deliberately separate from
   * the scan itself: the entry point is hidden when the answer is no, so nobody
   * photographs their shopping list only to be told we cannot read it (§37).
   */
  @Get('availability')
  availability() {
    return this.scanService.availability();
  }

  /**
   * Reads a photo of a grocery list.
   *
   * The rate-limit guard runs first and is per-shopper: this is the expensive
   * endpoint in the application (§41).
   *
   * Nothing is written by this call. The shopper reviews the result and
   * confirms separately (§60).
   */
  @Post('grocery-list')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ScanRateLimitGuard)
  @UseInterceptors(FileInterceptor('image', scanUploadOptions(ABSOLUTE_MAX_UPLOAD_BYTES)))
  scan(@CurrentUser('userId') userId: string, @UploadedFile() image?: UploadedImage) {
    return this.scanService.scan(userId, image);
  }

  /**
   * Adds the products the shopper confirmed to their cart.
   *
   * The body carries product ids and quantities and nothing else — the DTO
   * cannot express a price, and the global validation pipe rejects a request
   * that tries to send one. Every product is re-read from the catalogue before
   * anything is added (§29, §61).
   *
   * 200 rather than 201: the cart already existed, and this returns its new
   * state rather than a newly created resource.
   */
  @Post('grocery-list/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@CurrentUser('userId') userId: string, @Body() dto: ConfirmScanDto) {
    return this.scanService.confirm(userId, dto);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { PLATFORM_SETTINGS_KEY, PlatformSettings, PlatformSettingsDocument } from './schemas';

/** The settings an admin may change. All optional — updates are partial. */
export interface PlatformSettingsInput {
  maxDeliveryDistanceMeters?: number;
  defaultLowStockThreshold?: number;
  orderingEnabled?: boolean;
  supportPhone?: string;
  supportEmail?: string;
}

/** The business settings, plus the deployment facts an admin needs to see. */
export interface PlatformSettingsView {
  maxDeliveryDistanceMeters: number;
  defaultLowStockThreshold: number;
  orderingEnabled: boolean;
  supportPhone: string;
  supportEmail: string;
  updatedAt: Date | null;
  /**
   * Read-only. Shown so an admin is not left wondering why behaviour they
   * cannot find a switch for is the way it is. These are deployment concerns
   * (section 25) and are deliberately not editable from a web form.
   */
  environment: {
    paymentMethods: string[];
    routingProvider: string;
    aiServiceEnabled: boolean;
  };
}

/** What an unauthenticated browser is allowed to know. */
export interface PublicSettingsView {
  supportPhone: string;
  supportEmail: string;
  maxDeliveryDistanceMeters: number;
  orderingEnabled: boolean;
}

/** How long a cached read stays authoritative. See the caching note below. */
const CACHE_TTL_MS = 30_000;

/**
 * THE BUSINESS CONFIGURATION SERVICE
 *
 * One document, read by delivery, checkout and inventory. It sits at the bottom
 * of the module graph and depends on nothing, so any module may use it without
 * creating a cycle.
 *
 * CACHING: settings are read on nearly every checkout and change perhaps twice
 * a year, so the document is memoised for CACHE_TTL_MS and the cache is cleared
 * synchronously on every write. The TTL only matters for a second API instance
 * that did not perform the write — thirty seconds of staleness on a delivery
 * radius is acceptable; thirty seconds of staleness on a price would not be,
 * which is why no price is cached anywhere.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  private cached: PlatformSettingsDocument | null = null;
  private cachedAt = 0;

  constructor(
    @InjectModel(PlatformSettings.name)
    private readonly settingsModel: Model<PlatformSettingsDocument>,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /**
   * The settings document, created from schema defaults on first use.
   *
   * The upsert carries an empty `$setOnInsert` on purpose: the defaults live in
   * the schema, in one place, rather than being restated here where they could
   * drift away from it.
   */
  async get(): Promise<PlatformSettingsDocument> {
    if (this.cached && Date.now() - this.cachedAt < CACHE_TTL_MS) return this.cached;

    const document = await this.settingsModel
      .findOneAndUpdate(
        { key: PLATFORM_SETTINGS_KEY },
        { $setOnInsert: { key: PLATFORM_SETTINGS_KEY } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    this.cached = document;
    this.cachedAt = Date.now();
    return document;
  }

  /** The service radius, in metres. The only place this number comes from. */
  async maxDeliveryDistanceMeters(): Promise<number> {
    return (await this.get()).maxDeliveryDistanceMeters;
  }

  async defaultLowStockThreshold(): Promise<number> {
    return (await this.get()).defaultLowStockThreshold;
  }

  async isOrderingEnabled(): Promise<boolean> {
    return (await this.get()).orderingEnabled;
  }

  async view(): Promise<PlatformSettingsView> {
    const settings = await this.get();

    return {
      maxDeliveryDistanceMeters: settings.maxDeliveryDistanceMeters,
      defaultLowStockThreshold: settings.defaultLowStockThreshold,
      orderingEnabled: settings.orderingEnabled,
      supportPhone: settings.supportPhone,
      supportEmail: settings.supportEmail,
      updatedAt: settings.updatedAt ?? null,
      environment: {
        paymentMethods: this.configService.get('payments', { infer: true }).enabledMethods,
        routingProvider: this.configService.get('routing', { infer: true }).provider,
        aiServiceEnabled: this.configService.get('ai', { infer: true }).enabled,
      },
    };
  }

  /** The subset safe to hand an unauthenticated browser. */
  async publicView(): Promise<PublicSettingsView> {
    const settings = await this.get();

    return {
      supportPhone: settings.supportPhone,
      supportEmail: settings.supportEmail,
      maxDeliveryDistanceMeters: settings.maxDeliveryDistanceMeters,
      orderingEnabled: settings.orderingEnabled,
    };
  }

  /**
   * Applies a partial update.
   *
   * Only the fields actually present are written, and schema validators run on
   * the update — so a negative radius or a malformed support number is refused
   * at the persistence layer rather than trusted because a DTO allowed it.
   *
   * Returns the fields that genuinely changed, which is what the audit record
   * needs: "admin saved the settings form" is not an auditable fact, "admin
   * changed the delivery radius from 12000 to 8000" is.
   */
  async update(input: PlatformSettingsInput): Promise<{
    settings: PlatformSettingsDocument;
    changed: Record<string, { from: unknown; to: unknown }>;
  }> {
    const current = await this.get();

    const changed: Record<string, { from: unknown; to: unknown }> = {};
    const set: Record<string, unknown> = {};

    for (const [field, value] of Object.entries(input)) {
      if (value === undefined) continue;

      const previous = (current as unknown as Record<string, unknown>)[field];
      if (previous === value) continue;

      set[field] = value;
      changed[field] = { from: previous, to: value };
    }

    if (Object.keys(set).length === 0) return { settings: current, changed };

    const updated = await this.settingsModel
      .findOneAndUpdate(
        { key: PLATFORM_SETTINGS_KEY },
        { $set: set },
        { new: true, runValidators: true },
      )
      .exec();

    this.invalidate();
    this.logger.log('Platform settings updated: ' + Object.keys(changed).join(', '));

    return { settings: updated ?? current, changed };
  }

  private invalidate(): void {
    this.cached = null;
    this.cachedAt = 0;
  }
}

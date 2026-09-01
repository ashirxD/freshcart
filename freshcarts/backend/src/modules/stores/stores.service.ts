import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { BusinessException } from 'src/common/errors';
import { slugify, uniqueSlug } from 'src/common/utils';
import { SettingsService } from 'src/modules/settings';
import { CreateStoreDto, UpdateStoreDto } from './dto';
import { OpeningHours, Store, StoreDocument } from './schemas';

/** More stores than this platform is built to run from one back office. */
const MAX_STORES = 200;

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  /**
   * The active-store lookup runs on essentially every catalogue request, so the
   * resolved id is memoised. Only the id is cached — never a whole document —
   * so a store edit can never be served stale, and any write clears it anyway.
   */
  private cachedActiveStoreId: string | null = null;

  constructor(
    @InjectModel(Store.name) private readonly storeModel: Model<StoreDocument>,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Resolves the catalogue scope for customer-facing requests.
   *
   * Which store that is comes from configuration (DEFAULT_STORE_SLUG) or, when
   * none is set, the oldest active store — never a constant compiled into the
   * application.
   */
  async getActiveStoreId(): Promise<string> {
    if (this.cachedActiveStoreId) return this.cachedActiveStoreId;

    const configuredSlug = this.configService.get('store', { infer: true }).defaultSlug;
    const filter: FilterQuery<StoreDocument> = configuredSlug
      ? { slug: configuredSlug, isActive: true }
      : { isActive: true };

    const store = await this.storeModel
      .findOne(filter)
      .sort({ createdAt: 1 })
      .select('_id')
      .lean()
      .exec();

    if (!store) {
      throw new NotFoundException(
        configuredSlug
          ? 'Store "' + configuredSlug + '" is not available'
          : 'No active store is configured yet',
      );
    }

    this.cachedActiveStoreId = store._id.toString();
    return this.cachedActiveStoreId;
  }

  /** ObjectId form of {@link getActiveStoreId}, for building queries. */
  async getActiveStoreObjectId(): Promise<Types.ObjectId> {
    return new Types.ObjectId(await this.getActiveStoreId());
  }

  async findActiveStore(): Promise<StoreDocument> {
    const id = await this.getActiveStoreId();
    const store = await this.storeModel.findById(id).exec();

    if (!store) {
      this.invalidateCache();
      throw new NotFoundException('No active store is configured yet');
    }

    return store;
  }

  /**
   * Whether the store can take an order right now.
   *
   * Two conditions, both real: the store must be active, and — when it has
   * published opening hours — the current store-local time must fall inside
   * today's window. A store with no hours configured is treated as always open,
   * because "no data" must not silently close a shop.
   *
   * The comparison is on the "HH:mm" strings directly. They are zero-padded
   * 24-hour times, so lexicographic order is chronological order, and there is
   * no parsing to get wrong.
   */
  isAcceptingOrders(store: StoreDocument, now: Date = new Date()): boolean {
    if (!store.isActive) return false;

    const hours = store.openingHours ?? [];
    if (hours.length === 0) return true;

    const local = this.toStoreLocalTime(now);
    const today = hours.find((window) => window.day === local.day);

    // No entry for today means the store did not publish hours for it, which is
    // not the same as being closed.
    if (!today) return true;
    if (today.isClosed) return false;

    return local.time >= today.opensAt && local.time < today.closesAt;
  }

  /**
   * Refuses the order with wording a shopper can act on.
   *
   * Called from checkout, so an out-of-hours basket fails at validation rather
   * than becoming an order nobody will pick.
   *
   * Two independent gates, checked in the order an operator would expect. The
   * platform pause comes first because it is deliberate and immediate — an
   * admin stopping the queue during an incident should not be overridden by a
   * store that happens to be inside its published hours.
   */
  async assertAcceptingOrders(): Promise<StoreDocument> {
    if (!(await this.settingsService.isOrderingEnabled())) {
      throw BusinessException.storeUnavailable(
        'FreshCarts is not taking new orders at the moment. Please try again shortly.',
      );
    }

    const store = await this.findActiveStore();

    if (!this.isAcceptingOrders(store)) {
      throw BusinessException.storeUnavailable(
        store.isActive
          ? store.name + ' is closed right now. Please try again during opening hours.'
          : store.name + ' is not taking orders at the moment.',
      );
    }

    return store;
  }

  /** Store-local weekday and "HH:mm", derived from the configured UTC offset. */
  private toStoreLocalTime(now: Date): { day: number; time: string } {
    const offsetMinutes = this.configService.get('store', { infer: true }).timezoneOffsetMinutes;
    const shifted = new Date(now.getTime() + offsetMinutes * 60_000);

    const hours = String(shifted.getUTCHours()).padStart(2, '0');
    const minutes = String(shifted.getUTCMinutes()).padStart(2, '0');

    return { day: shifted.getUTCDay(), time: hours + ':' + minutes };
  }

  /**
   * Every store, for the admin list and for resolving store names on an order
   * page. Capped rather than paginated: the admin surface wants them all in one
   * map, and a platform with more stores than this needs a different screen
   * anyway — but section 39 rules out an uncapped `find()` on a collection an
   * admin can add to, however unlikely the cap is to bind.
   */
  list(includeInactive = false): Promise<StoreDocument[]> {
    return this.storeModel
      .find(includeInactive ? {} : { isActive: true })
      .sort({ createdAt: 1 })
      .limit(MAX_STORES)
      .exec();
  }

  async findByIdOrFail(id: string): Promise<StoreDocument> {
    const store = await this.storeModel.findById(id).exec();
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async create(dto: CreateStoreDto): Promise<StoreDocument> {
    const slug = await this.resolveSlug(dto.slug ?? dto.name);

    const store = await this.storeModel.create({
      ...dto,
      slug,
      openingHours: this.toOpeningHours(dto.openingHours),
      location: { type: 'Point', coordinates: [dto.location.longitude, dto.location.latitude] },
    });

    this.invalidateCache();
    this.logger.log('Store created: ' + store.slug);
    return store;
  }

  async update(id: string, dto: UpdateStoreDto): Promise<StoreDocument> {
    const store = await this.findByIdOrFail(id);

    if (dto.slug && dto.slug !== store.slug) {
      store.slug = await this.resolveSlug(dto.slug, store._id);
    }

    if (dto.location) {
      store.location = {
        type: 'Point',
        coordinates: [dto.location.longitude, dto.location.latitude],
      };
    }

    if (dto.address) store.address = { ...store.address, ...dto.address };
    if (dto.name !== undefined) store.name = dto.name;
    if (dto.description !== undefined) store.description = dto.description;
    if (dto.logoUrl !== undefined) store.logoUrl = dto.logoUrl;
    if (dto.phone !== undefined) store.phone = dto.phone;
    if (dto.email !== undefined) store.email = dto.email;
    if (dto.openingHours !== undefined) store.openingHours = this.toOpeningHours(dto.openingHours);
    if (dto.isActive !== undefined) store.isActive = dto.isActive;

    const saved = await store.save();
    this.invalidateCache();
    return saved;
  }

  private toOpeningHours(input: UpdateStoreDto['openingHours']): OpeningHours[] {
    return (input ?? []).map((window) => ({
      day: window.day as OpeningHours['day'],
      opensAt: window.opensAt,
      closesAt: window.closesAt,
      isClosed: window.isClosed ?? false,
    }));
  }

  /** Slug uniqueness is global for stores: it is the public URL segment. */
  private async resolveSlug(source: string, excludeId?: Types.ObjectId): Promise<string> {
    if (!slugify(source)) {
      throw new ConflictException('Store name must contain at least one letter or digit');
    }

    return uniqueSlug(source, async (candidate) => {
      const filter: FilterQuery<StoreDocument> = { slug: candidate };
      if (excludeId) filter._id = { $ne: excludeId };
      return (await this.storeModel.exists(filter)) !== null;
    });
  }

  private invalidateCache(): void {
    this.cachedActiveStoreId = null;
  }
}

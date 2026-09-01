import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { Address, AddressDocument } from 'src/modules/addresses/schemas';
import { Cart, CartDocument } from 'src/modules/cart/schemas';
import { CategoriesService } from 'src/modules/categories';
import { Category, CategoryDocument } from 'src/modules/categories/schemas';
import {
  DeliveryPricingRule,
  DeliveryPricingRuleDocument,
  DeliveryPricingService,
} from 'src/modules/delivery';
import { Favorite, FavoriteDocument } from 'src/modules/favorites/schemas';
import { Order, OrderDocument } from 'src/modules/orders/schemas';
import { Payment, PaymentDocument } from 'src/modules/payments/schemas';
import { Inventory, InventoryDocument } from 'src/modules/inventory/schemas';
import { SettingsService } from 'src/modules/settings';
import { Product, ProductDocument } from 'src/modules/products/schemas';
import { Store, StoreDocument, StoresService } from 'src/modules/stores';
import { User, UserDocument } from 'src/modules/users/schemas';
import { UsersService } from 'src/modules/users/users.service';
import { buildSeedCategories, buildSeedStore } from './data/catalog.seed';
import { buildSeedDeliveryPricingRules } from './data/delivery.seed';
import { buildSeedStoreManagers, buildSeedUsers } from './data/users.seed';

export interface SeedSummary {
  users: { created: number; skipped: number };
  stores: { created: number; skipped: number };
  storeManagers: { created: number; skipped: number };
  categories: { created: number; skipped: number };
  deliveryPricing: { created: number; skipped: number };
}

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly storesService: StoresService,
    private readonly categoriesService: CategoriesService,
    private readonly configService: ConfigService<AppConfig, true>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Store.name) private readonly storeModel: Model<StoreDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Inventory.name) private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(Address.name) private readonly addressModel: Model<AddressDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(DeliveryPricingRule.name)
    private readonly pricingRuleModel: Model<DeliveryPricingRuleDocument>,
    private readonly deliveryPricingService: DeliveryPricingService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Idempotent by design: running the seeder twice must not create duplicates or
   * overwrite data a developer has been working with. Everything is written
   * through the real services, so seeded records pass exactly the same
   * validation, slug generation and invariants as an admin's own writes.
   */
  async run(options: { fresh?: boolean } = {}): Promise<SeedSummary> {
    this.assertNotProduction();

    if (options.fresh) await this.wipe();

    const users = await this.seedUsers();
    const stores = await this.seedStores();
    // Store staff come after the stores: the User schema refuses to save a
    // STORE_MANAGER that is not bound to one.
    const storeManagers = await this.seedStoreManagers();
    const categories = await this.seedCategories();
    const deliveryPricing = await this.seedDeliveryPricing();

    return { users, stores, storeManagers, categories, deliveryPricing };
  }

  private async wipe(): Promise<void> {
    const results = await Promise.all([
      // Orders and payments first: they are the leaves of the graph.
      this.paymentModel.deleteMany({}),
      this.orderModel.deleteMany({}),
      this.addressModel.deleteMany({}),
      this.pricingRuleModel.deleteMany({}),
      this.favoriteModel.deleteMany({}),
      this.cartModel.deleteMany({}),
      this.inventoryModel.deleteMany({}),
      this.productModel.deleteMany({}),
      this.categoryModel.deleteMany({}),
      this.storeModel.deleteMany({}),
      this.userModel.deleteMany({}),
    ]);

    const removed = results.reduce((sum, result) => sum + result.deletedCount, 0);
    this.logger.warn('Fresh seed: removed ' + removed + ' existing document(s)');
  }

  private async seedUsers(): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const seedUser of buildSeedUsers()) {
      if (await this.usersService.findByPhone(seedUser.phone)) {
        skipped += 1;
        continue;
      }

      await this.usersService.create(seedUser);
      created += 1;
      this.logger.log('Created ' + seedUser.role + ' ' + seedUser.phone);
    }

    return { created, skipped };
  }

  /**
   * The store. One, because the platform runs one.
   *
   * Everything downstream is still keyed by `storeId`, so adding a second is
   * data entry from /admin/stores rather than a change here — but nothing is
   * seeded speculatively.
   */
  private async seedStores(): Promise<{ created: number; skipped: number }> {
    const definition = buildSeedStore();

    if (await this.storeModel.exists({ slug: definition.slug })) {
      return { created: 0, skipped: 1 };
    }

    const store = await this.storesService.create(definition);
    this.logger.log('Created store ' + store.slug);

    return { created: 1, skipped: 0 };
  }

  /** Store staff, bound to the store. */
  private async seedStoreManagers(): Promise<{ created: number; skipped: number }> {
    const primary = await this.storeModel
      .findOne({ slug: buildSeedStore().slug })
      .select('_id')
      .lean()
      .exec();

    if (!primary) {
      this.logger.warn('Skipping store managers: the seeded store is not present');
      return { created: 0, skipped: 0 };
    }

    let created = 0;
    let skipped = 0;

    const managers = buildSeedStoreManagers({ primaryStoreId: primary._id.toString() });

    for (const manager of managers) {
      if (await this.usersService.findByPhone(manager.phone)) {
        skipped += 1;
        continue;
      }

      await this.usersService.create(manager);
      created += 1;
      this.logger.log('Created STORE_MANAGER ' + manager.phone);
    }

    return { created, skipped };
  }

  private async seedCategories(): Promise<{ created: number; skipped: number }> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    let created = 0;
    let skipped = 0;

    for (const [index, definition] of buildSeedCategories().entries()) {
      const parentId = await this.upsertCategory(
        {
          name: definition.name,
          slug: definition.slug,
          description: definition.description,
          icon: definition.icon,
          displayOrder: (index + 1) * 10,
        },
        storeId,
        (wasCreated) => (wasCreated ? (created += 1) : (skipped += 1)),
      );

      for (const [childIndex, child] of (definition.children ?? []).entries()) {
        await this.upsertCategory(
          {
            name: child.name,
            slug: child.slug,
            icon: child.icon,
            parentId: parentId.toString(),
            displayOrder: (childIndex + 1) * 10,
          },
          storeId,
          (wasCreated) => (wasCreated ? (created += 1) : (skipped += 1)),
        );
      }
    }

    return { created, skipped };
  }

  private async upsertCategory(
    definition: {
      name: string;
      slug: string;
      description?: string;
      icon?: string;
      parentId?: string;
      displayOrder: number;
    },
    storeId: Types.ObjectId,
    record: (wasCreated: boolean) => void,
  ): Promise<Types.ObjectId> {
    const existing = await this.categoryModel
      .findOne({ slug: definition.slug, storeId })
      .select('_id')
      .lean()
      .exec();

    if (existing) {
      record(false);
      return existing._id;
    }

    const category = await this.categoriesService.create(definition);
    record(true);

    return category._id;
  }

  /**
   * NOTE: there is no `seedProducts`. The catalogue is entered by hand from
   * /admin/products — see the note in `catalog.seed.ts`. The Product model is
   * still injected above, because `--fresh` has to be able to clear the
   * collection whatever put rows in it.
   */

  private async seedDeliveryPricing(): Promise<{ created: number; skipped: number }> {
    const storeId = await this.storesService.getActiveStoreObjectId();
    const existing = await this.pricingRuleModel.countDocuments({ storeId }).exec();

    if (existing > 0) {
      await this.reportPricingProblems(storeId);
      return { created: 0, skipped: existing };
    }

    const rules = buildSeedDeliveryPricingRules();

    await this.pricingRuleModel.create(rules.map((rule) => ({ ...rule, storeId, isActive: true })));

    await this.reportPricingProblems(storeId);
    this.logger.log('Delivery pricing: ' + rules.length + ' band(s) created');

    return { created: rules.length, skipped: 0 };
  }

  private async reportPricingProblems(storeId: Types.ObjectId): Promise<void> {
    const bands = await this.deliveryPricingService.activeBands(storeId);
    // The service radius is business configuration, so it comes from the
    // settings document the admin screen edits — not from the environment.
    const maxDistance = await this.settingsService.maxDeliveryDistanceMeters();

    for (const problem of DeliveryPricingService.validateRuleSet(bands, maxDistance)) {
      this.logger.warn('Delivery pricing ' + problem.kind + ': ' + problem.message);
    }
  }

  /** Seeding writes known credentials — it must never touch a production database. */
  private assertNotProduction(): void {
    if (this.configService.get('isProduction', { infer: true })) {
      throw new Error('Refusing to seed: NODE_ENV is production');
    }
  }
}

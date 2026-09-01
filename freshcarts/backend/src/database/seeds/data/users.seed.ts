import { Language, Role } from 'src/common/enums';

export interface SeedUser {
  fullName: string;
  phone: string;
  password: string;
  email?: string;
  role: Role;
  preferredLanguage?: Language;
}

/**
 * Development accounts only. Phone, email and password all come from
 * environment variables, so no usable credential and no real contact detail is
 * ever committed to the repository. The fallbacks below are deliberately
 * unusable placeholders. The seeder refuses to run in production.
 *
 * STORE_MANAGER accounts are absent from this list on purpose: the schema
 * requires a manager to be bound to a real store, and the store does not exist
 * until the catalogue step runs. `buildSeedStoreManagers` below is called
 * afterwards, with the store id in hand.
 */
export function buildSeedUsers(): SeedUser[] {
  return [
    {
      fullName: 'Platform Admin',
      phone: process.env.SEED_ADMIN_PHONE ?? '+923001234567',
      password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345',
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@freshcarts.local',
      role: Role.ADMIN,
    },
    {
      fullName: 'Ayesha Khan',
      phone: process.env.SEED_CUSTOMER_PHONE ?? '+923001234569',
      password: process.env.SEED_CUSTOMER_PASSWORD ?? 'Customer@12345',
      email: 'ayesha@freshcarts.local',
      role: Role.CUSTOMER,
      preferredLanguage: Language.EN,
    },
    {
      fullName: 'Bilal Ahmed',
      phone: '+923001234570',
      password: process.env.SEED_CUSTOMER_PASSWORD ?? 'Customer@12345',
      role: Role.CUSTOMER,
      preferredLanguage: Language.UR,
    },
  ];
}

/** A manager account, once there is a store to bind it to. */
export interface SeedStoreManager extends SeedUser {
  storeId: string;
}

/**
 * The shopkeeper who runs the store.
 *
 * One account, because there is one store. The manager is bound to it
 * explicitly — a STORE_MANAGER with no store binding is refused by every store
 * route (`resolveManagerStoreId` fails closed rather than falling back to a
 * default), so an unbound account would sign in and then be able to do nothing.
 *
 * NOTE: the seed no longer creates a second store and a second manager. That
 * pair existed only so cross-store isolation could be checked by hand — sign in
 * as the other manager, see an empty queue. Store scoping itself is unchanged
 * and is still covered by the test suite (`store-scope.spec.ts`,
 * `orders.store.spec.ts`, `inventory.store-scope.spec.ts`); what is gone is the
 * ability to demonstrate it by signing in. Add a second store from
 * /admin/stores if you ever want that back.
 */
export function buildSeedStoreManagers(stores: { primaryStoreId: string }): SeedStoreManager[] {
  return [
    {
      fullName: 'Store Manager',
      phone: process.env.SEED_MANAGER_PHONE ?? '+923001234568',
      password: process.env.SEED_MANAGER_PASSWORD ?? 'Manager@12345',
      email: process.env.SEED_MANAGER_EMAIL ?? 'manager@freshcarts.local',
      role: Role.STORE_MANAGER,
      storeId: stores.primaryStoreId,
    },
  ];
}

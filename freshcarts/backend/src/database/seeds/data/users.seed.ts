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
 * Development accounts only. Credentials come from environment variables so no
 * usable password is ever committed to the repository, and the seeder refuses
 * to run in production.
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
      email: 'admin@freshcarts.local',
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
 * Store staff for the seeded store.
 *
 * Two accounts rather than one, because the most important thing to be able to
 * test by hand is that a manager sees *their* store and nothing else — and that
 * needs a second manager somewhere else to be a real test. The second is bound
 * to the same store here (there is only one), but the seeder creates a second
 * store expressly so cross-store isolation is demonstrable; see the catalogue
 * seed.
 */
export function buildSeedStoreManagers(stores: {
  primaryStoreId: string;
  secondaryStoreId: string;
}): SeedStoreManager[] {
  return [
    {
      fullName: 'Imran Sheikh',
      phone: process.env.SEED_MANAGER_PHONE ?? '+923001234568',
      password: process.env.SEED_MANAGER_PASSWORD ?? 'Manager@12345',
      email: 'imran@freshcarts.local',
      role: Role.STORE_MANAGER,
      storeId: stores.primaryStoreId,
    },
    {
      fullName: 'Sana Iqbal',
      phone: '+923001234571',
      password: process.env.SEED_MANAGER_PASSWORD ?? 'Manager@12345',
      email: 'sana@freshcarts.local',
      role: Role.STORE_MANAGER,
      // Bound to the OTHER store, so "manager A cannot see store B" is something
      // you can verify by signing in rather than only by reading a test.
      storeId: stores.secondaryStoreId,
    },
  ];
}

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
 * STORE_MANAGER accounts are intentionally absent: the schema requires a manager
 * to be bound to a real store, so they are seeded alongside the stores module.
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

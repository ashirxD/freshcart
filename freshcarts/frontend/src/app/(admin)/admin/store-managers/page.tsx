import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { AdminStoreManagersScreen } from './store-managers-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('admin.nav.storeManagers') };
}

export default function Page() {
  return <AdminStoreManagersScreen />;
}

import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { AdminStoresScreen } from './stores-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('admin.nav.stores') };
}

export default function Page() {
  return <AdminStoresScreen />;
}

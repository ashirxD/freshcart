import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { InventoryScreen } from './inventory-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('admin.nav.inventory') };
}

export default function Page() {
  return <InventoryScreen />;
}

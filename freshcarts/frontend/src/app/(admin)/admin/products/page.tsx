import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { ProductsAdminScreen } from './products-admin-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('admin.nav.products') };
}

export default function Page() {
  return <ProductsAdminScreen />;
}

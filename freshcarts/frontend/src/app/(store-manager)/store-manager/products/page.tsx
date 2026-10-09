import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { ProductsScreen } from './products-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('store.shell.products') };
}

export default function Page() {
  return <ProductsScreen />;
}

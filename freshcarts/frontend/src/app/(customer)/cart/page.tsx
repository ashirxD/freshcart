import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { CartScreen } from './cart-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('cart.title') };
}

export default function Page() {
  return <CartScreen />;
}

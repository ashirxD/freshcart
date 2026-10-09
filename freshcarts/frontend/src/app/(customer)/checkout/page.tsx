import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { CheckoutScreen } from './checkout-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('checkout.screen.title') };
}

export default function Page() {
  return <CheckoutScreen />;
}

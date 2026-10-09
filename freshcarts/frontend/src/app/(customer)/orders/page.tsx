import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { OrdersScreen } from './orders-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('orders.list.title') };
}

export default function Page() {
  return <OrdersScreen />;
}

import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { OrderDetailScreen } from './order-detail-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('meta.orderDetails') };
}

/**
 * The order id is a route parameter rather than a query, so the page is
 * shareable and the browser's back button behaves the way a shopper expects.
 * Authorisation is entirely server-side: the API scopes every order read to the
 * authenticated user, so an id in the URL grants nothing on its own.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailScreen orderId={id} />;
}

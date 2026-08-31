import { OrderDetailScreen } from './order-detail-screen';

export const metadata = { title: 'Order details' };

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

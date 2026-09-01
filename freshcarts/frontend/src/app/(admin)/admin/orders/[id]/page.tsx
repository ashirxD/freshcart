import { AdminOrderDetailScreen } from './order-detail-screen';

export const metadata = { title: 'Order' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminOrderDetailScreen id={id} />;
}

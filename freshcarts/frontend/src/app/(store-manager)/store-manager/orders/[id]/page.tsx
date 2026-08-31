import { OrderDetailScreen } from './order-detail-screen';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: 'Order' };

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <OrderDetailScreen id={id} />;
}

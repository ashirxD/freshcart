import { AdminCustomerDetailScreen } from './customer-detail-screen';

export const metadata = { title: 'Customer' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminCustomerDetailScreen id={id} />;
}

import { ConfirmationScreen } from './confirmation-screen';

export const metadata = { title: 'Order placed' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConfirmationScreen orderId={id} />;
}

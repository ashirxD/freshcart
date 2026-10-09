import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { ConfirmationScreen } from './confirmation-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('meta.orderPlaced') };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConfirmationScreen orderId={id} />;
}

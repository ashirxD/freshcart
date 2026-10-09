import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { OrderDetailScreen } from './order-detail-screen';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('store.meta.order') };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <OrderDetailScreen id={id} />;
}

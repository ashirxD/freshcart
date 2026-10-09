import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { AdminOrderDetailScreen } from './order-detail-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('admin.meta.order') };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminOrderDetailScreen id={id} />;
}

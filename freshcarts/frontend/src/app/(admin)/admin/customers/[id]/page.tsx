import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { AdminCustomerDetailScreen } from './customer-detail-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('admin.meta.customer') };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminCustomerDetailScreen id={id} />;
}

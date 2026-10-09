import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { AdminCustomersScreen } from './customers-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('admin.nav.customers') };
}

export default function Page() {
  return <AdminCustomersScreen />;
}

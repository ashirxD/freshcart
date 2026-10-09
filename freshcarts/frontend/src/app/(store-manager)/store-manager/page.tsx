import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { DashboardScreen } from './dashboard-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('store.shell.dashboard') };
}

export default function Page() {
  return <DashboardScreen />;
}

import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { AdminDashboardScreen } from './dashboard-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('admin.nav.dashboard') };
}

/** The back office opens on the control centre, which is what it is for. */
export default function Page() {
  return <AdminDashboardScreen />;
}

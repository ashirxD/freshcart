import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { AdminSettingsScreen } from './settings-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('admin.nav.settings') };
}

export default function Page() {
  return <AdminSettingsScreen />;
}

import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { CategoriesAdminScreen } from './categories-admin-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('admin.nav.categories') };
}

export default function Page() {
  return <CategoriesAdminScreen />;
}

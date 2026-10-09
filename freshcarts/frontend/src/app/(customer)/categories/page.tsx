import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { CategoriesScreen } from './categories-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('nav.categories') };
}

export default function Page() {
  return <CategoriesScreen />;
}

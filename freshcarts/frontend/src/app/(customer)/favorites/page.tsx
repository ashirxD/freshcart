import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { FavoritesScreen } from './favorites-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('favorites.title') };
}

export default function Page() {
  return <FavoritesScreen />;
}

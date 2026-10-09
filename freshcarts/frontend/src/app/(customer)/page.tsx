import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { HomeScreen } from './home-screen';

/**
 * Server component: it owns the route's metadata and renders the interactive
 * screen, which is the only part that needs to run in the browser.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: { absolute: t('meta.siteTitle') } };
}

export default function Page() {
  return <HomeScreen />;
}

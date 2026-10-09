import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { ScanScreen } from './scan-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('meta.scanTitle'), description: t('meta.scanDescription') };
}

export default function Page() {
  return <ScanScreen />;
}

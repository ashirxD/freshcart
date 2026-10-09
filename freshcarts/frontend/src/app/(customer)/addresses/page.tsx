import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { AddressesScreen } from './addresses-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('addresses.title') };
}

export default function Page() {
  return <AddressesScreen />;
}

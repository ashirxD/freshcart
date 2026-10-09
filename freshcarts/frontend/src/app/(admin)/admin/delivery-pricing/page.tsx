import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { AdminDeliveryPricingScreen } from './delivery-pricing-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('admin.nav.deliveryPricing') };
}

export default function Page() {
  return <AdminDeliveryPricingScreen />;
}

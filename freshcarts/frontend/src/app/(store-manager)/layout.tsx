import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { StoreShell } from './store-manager/store-shell';

/**
 * The store operations console sits in its own route group.
 *
 * Outside the customer chrome (no cart, no shopping tabs) and outside the admin
 * chrome (staff are not platform administrators). Same design tokens, same
 * components — a different composition for a different job (§39).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();

  return {
    title: { default: t('store.meta.title'), template: '%s · ' + t('store.meta.suffix') },
  };
}

export default function StoreManagerLayout({ children }: { children: ReactNode }) {
  return <StoreShell>{children}</StoreShell>;
}

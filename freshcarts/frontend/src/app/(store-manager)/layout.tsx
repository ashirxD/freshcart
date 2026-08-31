import type { ReactNode } from 'react';
import { StoreShell } from './store-manager/store-shell';

/**
 * The store operations console sits in its own route group.
 *
 * Outside the customer chrome (no cart, no shopping tabs) and outside the admin
 * chrome (staff are not platform administrators). Same design tokens, same
 * components — a different composition for a different job (§39).
 */
export const metadata = {
  title: { default: 'Store operations', template: '%s · FreshCarts store' },
};

export default function StoreManagerLayout({ children }: { children: ReactNode }) {
  return <StoreShell>{children}</StoreShell>;
}

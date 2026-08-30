import type { ReactNode } from 'react';
import { AdminShell } from './admin/admin-shell';

/**
 * The back office sits in its own route group, outside the customer chrome:
 * an admin managing the catalogue has no use for a shopping tab bar, and the
 * two audiences want different navigation entirely.
 */
export const metadata = { title: { default: 'Admin', template: '%s · FreshCarts admin' } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}

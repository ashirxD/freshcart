import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { AdminShell } from './admin/admin-shell';

/**
 * The back office sits in its own route group, outside the customer chrome:
 * an admin managing the catalogue has no use for a shopping tab bar, and the
 * two audiences want different navigation entirely.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();

  return { title: { default: t('admin.meta.title'), template: '%s · ' + t('admin.meta.suffix') } };
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}

import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';

/**
 * Chrome for the shopping experience. The (auth) route group deliberately sits
 * outside this layout so sign-in screens stay focused, with no navigation to
 * wander off into.
 */
export default function CustomerLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

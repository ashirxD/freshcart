'use client';

import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n';

/**
 * Whether a catalogue record is visible to shoppers.
 *
 * "Live" / "Hidden" rather than "Active" / "Inactive": the question an admin is
 * actually asking is whether customers can see it. Built on the shared Badge so
 * it cannot drift from the order-status pills sitting in the next column.
 */
export function StatusPill({ isActive, className }: { isActive: boolean; className?: string }) {
  const t = useT();

  return (
    <Badge tone={isActive ? 'fresh' : 'neutral'} className={className}>
      {isActive ? t('admin.pill.live') : t('admin.pill.hidden')}
    </Badge>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { SelectField } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { useOverrideOrderStatus } from '@/features/admin/admin.hooks';
import { useI18n } from '@/i18n';
import { actionLabel } from '@/lib/store-copy';
import type { AdminOrderDetail } from '@/types/admin';
import type { OrderStatus } from '@/types/order';

/** A reason short enough to be meaningless is worse than none. */
const MIN_REASON_LENGTH = 3;

/**
 * THE ADMIN OVERRIDE
 *
 * The status list offered here is `order.availableActions` — the server's own
 * state machine, for this order's fulfilment method. The dialog never composes
 * its own list of statuses, so it cannot offer a transition the API would
 * refuse: a pickup order shows no "out for delivery", a cancelled order shows
 * nothing at all.
 *
 * The reason is required by the client AND by the server. The client copy
 * exists so an admin is told before they submit; the server rule is the one
 * that actually holds, because a form is not a security boundary.
 */
export function OverrideStatusDialog({
  order,
  open,
  onClose,
}: {
  order: AdminOrderDetail;
  open: boolean;
  onClose: () => void;
}) {
  const { t, locale, ltr } = useI18n();
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [reason, setReason] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  const override = useOverrideOrderStatus(order.id, () => {
    onClose();
  });

  // Reset between openings, so a previous half-filled attempt does not reappear.
  useEffect(() => {
    if (open) {
      setStatus('');
      setReason('');
      setShowErrors(false);
    }
  }, [open]);

  const trimmedReason = reason.trim();
  const reasonError =
    trimmedReason.length < MIN_REASON_LENGTH ? t('admin.override.errReason') : undefined;
  const statusError = status ? undefined : t('admin.override.errStatus');

  const submit = () => {
    if (statusError || reasonError) {
      setShowErrors(true);
      return;
    }

    override.mutate({ status: status as OrderStatus, reason: trimmedReason });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('admin.override.title', { order: ltr(order.orderNumber) })}
      description={t('admin.override.description')}
      variant="centered"
      footer={
        <div className="gap-gutter flex justify-end">
          <Button variant="outline" onClick={onClose} disabled={override.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            isLoading={override.isPending}
            leadingIcon={<ShieldAlert className="size-4" aria-hidden="true" />}
          >
            {t('admin.override.apply')}
          </Button>
        </div>
      }
    >
      <div className="gap-gutter flex flex-col">
        <SelectField
          label={t('admin.override.moveTo')}
          placeholder={t('admin.override.chooseStatus')}
          value={status}
          error={showErrors ? statusError : undefined}
          onChange={(event) => setStatus(event.target.value as OrderStatus)}
          // Exactly the transitions the server would accept right now.
          options={order.availableActions.map((action) => ({
            value: action.status,
            label: actionLabel(action, t, locale),
          }))}
          hint={t('admin.override.statusHint')}
        />

        <Textarea
          label={t('admin.override.reason')}
          value={reason}
          maxLength={300}
          onChange={(event) => setReason(event.target.value)}
          error={showErrors ? reasonError : undefined}
          hint={t('admin.override.reasonHint')}
          placeholder={t('admin.override.reasonPlaceholder')}
        />
      </div>
    </Modal>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { SelectField, TextareaField } from '@/components/admin/form-field';
import { useRejectOrder, useUpdateOrderStatus } from '@/features/store-manager/store-manager.hooks';
import { REJECTION_REASONS, type RejectionReason } from '@/types/store-manager';
import type { StoreOrderAction, StoreOrderDetail } from '@/types/store-manager';

/**
 * The actions on an order, exactly as the server offers them.
 *
 * This component contains no rule about which transition comes next — it renders
 * `order.availableActions`. That is what makes it impossible for the console to
 * show a button the API would refuse: a pickup order never carries an
 * "Out for delivery" action, so the button cannot be drawn.
 *
 * §46: nothing here is optimistic. The mutation runs, the button shows its
 * pending state, and the screen only changes when the server has agreed. An
 * order status is a business fact the shopper is watching too, and telling staff
 * a handover was recorded when it was not is the failure mode worth spending a
 * spinner to avoid.
 */
export function OrderActionBar({ order }: { order: StoreOrderDetail }) {
  const [confirming, setConfirming] = useState<StoreOrderAction | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const updateStatus = useUpdateOrderStatus(() => setConfirming(null));
  const reject = useRejectOrder(() => setRejecting(false));

  const isPending = updateStatus.isPending || reject.isPending;

  if (order.availableActions.length === 0) {
    return (
      <p className="text-text-muted bg-surface-muted p-gutter rounded-xl text-sm">
        This order is {order.statusLabel.toLowerCase()}. There is nothing left to do.
      </p>
    );
  }

  const primary = order.availableActions.find((action) => action.intent === 'PRIMARY');
  const others = order.availableActions.filter((action) => action.intent !== 'PRIMARY');

  return (
    <>
      <div className="gap-gutter flex flex-wrap items-center">
        {primary ? (
          <Button
            size="lg"
            isLoading={updateStatus.isPending && confirming === null}
            disabled={isPending}
            onClick={() => updateStatus.mutate({ id: order.id, status: primary.status })}
          >
            {primary.label}
          </Button>
        ) : null}

        {others.map((action) => (
          <Button
            key={action.action}
            variant={action.intent === 'DESTRUCTIVE' ? 'outline' : 'ghost'}
            disabled={isPending}
            // Destructive actions always confirm first, and never sit flush
            // against the primary button (§42, §43).
            onClick={() =>
              action.action === 'REJECT' ? setRejecting(true) : setConfirming(action)
            }
          >
            {action.label}
          </Button>
        ))}
      </div>

      {/* Cancel / could-not-complete: a reason is required, and the API enforces it. */}
      <ReasonDialog
        action={confirming}
        orderNumber={order.orderNumber}
        isSubmitting={updateStatus.isPending}
        onCancel={() => setConfirming(null)}
        onSubmit={(reason) =>
          confirming && updateStatus.mutate({ id: order.id, status: confirming.status, reason })
        }
      />

      <RejectDialog
        open={rejecting}
        orderNumber={order.orderNumber}
        isSubmitting={reject.isPending}
        onCancel={() => setRejecting(false)}
        onSubmit={(reason, note) => reject.mutate({ id: order.id, reason, note })}
      />
    </>
  );
}

/**
 * Confirmation for a destructive action that is not a rejection.
 *
 * Free text rather than a preset list, because "cancel" and "could not
 * complete" cover situations too varied to enumerate honestly — and a shopper
 * reading "OTHER" in their timeline learns nothing.
 */
function ReasonDialog({
  action,
  orderNumber,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  action: StoreOrderAction | null;
  orderNumber: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  if (!action) return null;

  return (
    <Modal
      open
      onClose={onCancel}
      title={action.label}
      description={'Order ' + orderNumber + '. The customer will see the reason you give.'}
      footer={
        <div className="gap-gutter flex">
          <Button
            variant="danger"
            fullWidth
            isLoading={isSubmitting}
            disabled={reason.trim().length < 3}
            onClick={() => onSubmit(reason.trim())}
          >
            {action.label}
          </Button>
          <Button variant="outline" fullWidth onClick={onCancel}>
            Keep order
          </Button>
        </div>
      }
    >
      <TextareaField
        label="Reason"
        hint="At least a few words. This appears in the customer's order timeline."
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
      />
    </Modal>
  );
}

/**
 * The rejection dialog (§44).
 *
 * A preset reason plus an optional note. The shopper-facing sentence is composed
 * server-side from the preset, so a manager's shorthand never becomes the
 * customer's explanation.
 */
function RejectDialog({
  open,
  orderNumber,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  orderNumber: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (reason: RejectionReason, note?: string) => void;
}) {
  const [reason, setReason] = useState<RejectionReason>('ITEMS_UNAVAILABLE');
  const [note, setNote] = useState('');

  if (!open) return null;

  return (
    <Modal
      open
      onClose={onCancel}
      title="Reject order"
      description={'Order ' + orderNumber + ' will be closed and the stock returned.'}
      footer={
        <div className="gap-gutter flex">
          <Button
            variant="danger"
            fullWidth
            isLoading={isSubmitting}
            onClick={() => onSubmit(reason, note.trim() || undefined)}
          >
            Reject order
          </Button>
          <Button variant="outline" fullWidth onClick={onCancel}>
            Cancel
          </Button>
        </div>
      }
    >
      <div className="gap-gutter flex flex-col">
        <SelectField
          label="Reason"
          options={REJECTION_REASONS.map((option) => ({ ...option }))}
          value={reason}
          onChange={(event) => setReason(event.target.value as RejectionReason)}
        />

        <Input
          label="Note (optional)"
          hint="Added to what the customer sees."
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </Modal>
  );
}

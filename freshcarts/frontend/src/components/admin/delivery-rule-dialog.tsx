'use client';

import { useEffect, useState } from 'react';
import { CheckboxField } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useCreateDeliveryRule, useUpdateDeliveryRule } from '@/features/admin/admin.hooks';
import type { DeliveryRule } from '@/types/admin';

/** A single delivery fee cannot plausibly exceed this. Mirrors the schema. */
const MAX_FEE_PKR = 5_000;

interface FormState {
  label: string;
  fromKm: string;
  toKm: string;
  fee: string;
  isActive: boolean;
}

const EMPTY: FormState = { label: '', fromKm: '', toKm: '', fee: '', isActive: true };

/**
 * ONE DISTANCE BAND
 *
 * The form works in kilometres and the API in metres, because an admin thinks
 * "0 to 2 km" and the engine measures roads in metres. The conversion happens
 * once, here, on submit — nowhere else in the client is a distance rescaled.
 *
 * Client validation covers what can be judged from this form alone: a negative
 * distance, an inverted range, a negative or absurd fee. What it deliberately
 * does NOT try to judge is whether the band overlaps another — that depends on
 * every other rule, and the server checks it against the live set and refuses
 * with a sentence naming the band it clashes with.
 */
export function DeliveryRuleDialog({
  rule,
  open,
  onClose,
}: {
  rule: DeliveryRule | null;
  open: boolean;
  onClose: () => void;
}) {
  const isEditing = rule !== null;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [showErrors, setShowErrors] = useState(false);

  const create = useCreateDeliveryRule(onClose);
  const update = useUpdateDeliveryRule(onClose);
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;

    setShowErrors(false);
    setForm(
      rule
        ? {
            label: rule.label,
            fromKm: String(rule.minDistanceMeters / 1000),
            toKm: String(rule.maxDistanceMeters / 1000),
            fee: String(rule.fee),
            isActive: rule.isActive,
          }
        : EMPTY,
    );
  }, [open, rule]);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  const fromKm = Number(form.fromKm);
  const toKm = Number(form.toKm);
  const fee = Number(form.fee);

  const errors = {
    label: form.label.trim().length < 2 ? 'Give this band a name staff will recognise' : undefined,
    fromKm:
      form.fromKm !== '' && Number.isFinite(fromKm) && fromKm >= 0
        ? undefined
        : 'Enter a distance of 0 km or more',
    toKm:
      form.toKm === '' || !Number.isFinite(toKm)
        ? 'Enter the upper distance'
        : toKm <= fromKm
          ? 'The upper distance must be greater than the lower one'
          : undefined,
    fee:
      form.fee !== '' && Number.isInteger(fee) && fee >= 0 && fee <= MAX_FEE_PKR
        ? undefined
        : 'Enter a whole fee between Rs. 0 and Rs. ' + MAX_FEE_PKR,
  };

  const hasErrors = Object.values(errors).some(Boolean);

  const submit = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }

    const payload = {
      label: form.label.trim(),
      // Kilometres to metres, rounded: the engine stores whole metres.
      minDistanceMeters: Math.round(fromKm * 1000),
      maxDistanceMeters: Math.round(toKm * 1000),
      fee,
      isActive: form.isActive,
    };

    if (rule) update.mutate({ id: rule.id, ...payload });
    else create.mutate(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit ' + rule.label : 'Add a pricing band'}
      description="Changes apply to future orders. Orders already placed keep the fee they were charged."
      variant="centered"
      footer={
        <div className="gap-gutter flex justify-end">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} isLoading={isPending}>
            {isEditing ? 'Save band' : 'Add band'}
          </Button>
        </div>
      }
    >
      <div className="gap-gutter flex flex-col">
        <Input
          label="Band name"
          value={form.label}
          onChange={(event) => set('label', event.target.value)}
          error={showErrors ? errors.label : undefined}
          hint="Staff only — shoppers never see this. For example: Nearby, Across town."
        />

        <div className="gap-gutter grid sm:grid-cols-2">
          <Input
            label="From (km)"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            value={form.fromKm}
            onChange={(event) => set('fromKm', event.target.value)}
            error={showErrors ? errors.fromKm : undefined}
            hint="Included in this band"
          />

          <Input
            label="Up to (km)"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            value={form.toKm}
            onChange={(event) => set('toKm', event.target.value)}
            error={showErrors ? errors.toKm : undefined}
            hint="Not included — the next band starts here"
          />
        </div>

        <Input
          label="Fee (Rs.)"
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_FEE_PKR}
          step={1}
          value={form.fee}
          onChange={(event) => set('fee', event.target.value)}
          error={showErrors ? errors.fee : undefined}
        />

        <CheckboxField
          label="In use"
          hint="Only bands that are in use are considered when pricing a delivery."
          checked={form.isActive}
          onChange={(checked) => set('isActive', checked)}
        />
      </div>
    </Modal>
  );
}

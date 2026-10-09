'use client';

import { useEffect, useState } from 'react';
import { CheckboxField } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useCreateDeliveryRule, useUpdateDeliveryRule } from '@/features/admin/admin.hooks';
import { useI18n } from '@/i18n';
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
  const { t } = useI18n();
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
    label: form.label.trim().length < 2 ? t('admin.ruleDialog.errLabel') : undefined,
    fromKm:
      form.fromKm !== '' && Number.isFinite(fromKm) && fromKm >= 0
        ? undefined
        : t('admin.ruleDialog.errFrom'),
    toKm:
      form.toKm === '' || !Number.isFinite(toKm)
        ? t('admin.ruleDialog.errToMissing')
        : toKm <= fromKm
          ? t('admin.ruleDialog.errToOrder')
          : undefined,
    fee:
      form.fee !== '' && Number.isInteger(fee) && fee >= 0 && fee <= MAX_FEE_PKR
        ? undefined
        : t('admin.ruleDialog.errFee', { max: MAX_FEE_PKR }),
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
      title={
        isEditing
          ? t('admin.ruleDialog.editTitle', { label: rule.label })
          : t('admin.ruleDialog.addTitle')
      }
      description={t('admin.ruleDialog.description')}
      variant="centered"
      footer={
        <div className="gap-gutter flex justify-end">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} isLoading={isPending}>
            {isEditing ? t('admin.ruleDialog.saveBand') : t('admin.ruleDialog.addBand')}
          </Button>
        </div>
      }
    >
      <div className="gap-gutter flex flex-col">
        <Input
          label={t('admin.ruleDialog.label')}
          value={form.label}
          onChange={(event) => set('label', event.target.value)}
          error={showErrors ? errors.label : undefined}
          hint={t('admin.ruleDialog.labelHint')}
        />

        <div className="gap-gutter grid sm:grid-cols-2">
          <Input
            label={t('admin.ruleDialog.from')}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            value={form.fromKm}
            onChange={(event) => set('fromKm', event.target.value)}
            error={showErrors ? errors.fromKm : undefined}
            hint={t('admin.ruleDialog.fromHint')}
          />

          <Input
            label={t('admin.ruleDialog.to')}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            value={form.toKm}
            onChange={(event) => set('toKm', event.target.value)}
            error={showErrors ? errors.toKm : undefined}
            hint={t('admin.ruleDialog.toHint')}
          />
        </div>

        <Input
          label={t('admin.ruleDialog.fee')}
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
          label={t('admin.ruleDialog.inUse')}
          hint={t('admin.ruleDialog.inUseHint')}
          checked={form.isActive}
          onChange={(checked) => set('isActive', checked)}
        />
      </div>
    </Modal>
  );
}

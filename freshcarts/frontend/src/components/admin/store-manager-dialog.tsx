'use client';

import { useEffect, useState } from 'react';
import { SelectField } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useCreateStoreManager, useUpdateStoreManager } from '@/features/admin/admin.hooks';
import { useI18n } from '@/i18n';
import { isValidPkMobile, normalisePkPhone } from '@/lib/phone';
import type { AdminStore, AdminStoreManager } from '@/types/admin';

interface FormState {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  storeId: string;
}

const EMPTY: FormState = { fullName: '', phone: '', email: '', password: '', storeId: '' };

/**
 * CREATE OR EDIT A STORE MANAGER
 *
 * One dialog for both, because the fields are the same set minus two: an
 * existing manager's phone is their login identifier and is not editable here,
 * and there is no password field on an edit at all. Resetting somebody else's
 * credential is a different operation with different consequences, and folding
 * it into a general edit form is how it gets done by accident.
 *
 * A store is mandatory on creation. A manager with no store binding is refused
 * by every store route server-side, so creating one would produce an account
 * that signs in and can then do nothing.
 *
 * Validation here mirrors the server's and is a courtesy, not a control: the
 * API applies the same rules, and it is the one that decides.
 */
export function StoreManagerDialog({
  manager,
  open,
  stores,
  onClose,
}: {
  /** null when creating. */
  manager: AdminStoreManager | null;
  open: boolean;
  stores: AdminStore[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const isEditing = manager !== null;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [showErrors, setShowErrors] = useState(false);

  const create = useCreateStoreManager(onClose);
  const update = useUpdateStoreManager(onClose);
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;

    setShowErrors(false);
    setForm(
      manager
        ? {
            fullName: manager.fullName,
            phone: manager.phone,
            email: manager.email ?? '',
            password: '',
            storeId: manager.store?.id ?? '',
          }
        : EMPTY,
    );
  }, [open, manager]);

  const set = (field: keyof FormState) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const errors = {
    fullName: form.fullName.trim().length < 2 ? t('admin.managerDialog.errName') : undefined,
    phone:
      isEditing || isValidPkMobile(form.phone)
        ? undefined
        : t('admin.managerDialog.errPhone'),
    password:
      isEditing ||
      (form.password.length >= 8 && /[A-Za-z]/.test(form.password) && /\d/.test(form.password))
        ? undefined
        : t('admin.managerDialog.errPassword'),
    storeId: form.storeId ? undefined : t('admin.managerDialog.errStore'),
  };

  const hasErrors = Object.values(errors).some(Boolean);

  const submit = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }

    const email = form.email.trim() || undefined;

    if (manager) {
      update.mutate({
        id: manager.id,
        fullName: form.fullName.trim(),
        email,
        storeId: form.storeId,
      });
      return;
    }

    create.mutate({
      fullName: form.fullName.trim(),
      phone: normalisePkPhone(form.phone),
      email,
      password: form.password,
      storeId: form.storeId,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isEditing
          ? t('admin.managerDialog.editTitle', { name: manager.fullName })
          : t('admin.managerDialog.addTitle')
      }
      description={
        isEditing ? t('admin.managerDialog.editDesc') : t('admin.managerDialog.addDesc')
      }
      variant="centered"
      footer={
        <div className="gap-gutter flex justify-end">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} isLoading={isPending}>
            {isEditing ? t('admin.managerDialog.saveChanges') : t('admin.managerDialog.create')}
          </Button>
        </div>
      }
    >
      <div className="gap-gutter flex flex-col">
        <Input
          label={t('admin.managerDialog.fullName')}
          value={form.fullName}
          onChange={(event) => set('fullName')(event.target.value)}
          error={showErrors ? errors.fullName : undefined}
          autoComplete="name"
        />

        <Input
          label={t('admin.managerDialog.phone')}
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(event) => set('phone')(event.target.value)}
          error={showErrors ? errors.phone : undefined}
          // The login identifier. Changing it would change who the account is,
          // which is an account recovery operation, not an edit.
          disabled={isEditing}
          hint={isEditing ? t('admin.managerDialog.phoneHintEdit') : '03001234567'}
          autoComplete="tel"
        />

        <Input
          label={t('admin.managerDialog.email')}
          type="email"
          value={form.email}
          onChange={(event) => set('email')(event.target.value)}
          autoComplete="email"
        />

        {!isEditing ? (
          <Input
            label={t('admin.managerDialog.password')}
            type="password"
            value={form.password}
            onChange={(event) => set('password')(event.target.value)}
            error={showErrors ? errors.password : undefined}
            hint={t('admin.managerDialog.passwordHint')}
            autoComplete="new-password"
          />
        ) : null}

        <SelectField
          label={t('admin.managerDialog.store')}
          placeholder={t('admin.managerDialog.chooseStore')}
          value={form.storeId}
          onChange={(event) => set('storeId')(event.target.value)}
          error={showErrors ? errors.storeId : undefined}
          options={stores.map((store) => ({
            value: store.id,
            label: store.isActive
              ? store.name
              : t('admin.managerDialog.inactiveOption', { name: store.name }),
          }))}
          hint={t('admin.managerDialog.storeHint')}
        />
      </div>
    </Modal>
  );
}

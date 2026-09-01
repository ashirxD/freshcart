'use client';

import { useEffect, useState } from 'react';
import { SelectField } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useCreateStoreManager, useUpdateStoreManager } from '@/features/admin/admin.hooks';
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
    fullName: form.fullName.trim().length < 2 ? 'Enter their full name' : undefined,
    phone:
      isEditing || isValidPkMobile(form.phone)
        ? undefined
        : 'Enter a valid Pakistani mobile number, for example 03001234567',
    password:
      isEditing ||
      (form.password.length >= 8 && /[A-Za-z]/.test(form.password) && /\d/.test(form.password))
        ? undefined
        : 'At least 8 characters, with a letter and a number',
    storeId: form.storeId ? undefined : 'Choose the store they will run',
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
      title={isEditing ? 'Edit ' + manager.fullName : 'Add a store manager'}
      description={
        isEditing
          ? 'Moving them to another store signs them out of the old one immediately.'
          : 'They will sign in with this phone number and password.'
      }
      variant="centered"
      footer={
        <div className="gap-gutter flex justify-end">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} isLoading={isPending}>
            {isEditing ? 'Save changes' : 'Create manager'}
          </Button>
        </div>
      }
    >
      <div className="gap-gutter flex flex-col">
        <Input
          label="Full name"
          value={form.fullName}
          onChange={(event) => set('fullName')(event.target.value)}
          error={showErrors ? errors.fullName : undefined}
          autoComplete="name"
        />

        <Input
          label="Phone number"
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(event) => set('phone')(event.target.value)}
          error={showErrors ? errors.phone : undefined}
          // The login identifier. Changing it would change who the account is,
          // which is an account recovery operation, not an edit.
          disabled={isEditing}
          hint={isEditing ? 'The sign-in number cannot be changed here.' : '03001234567'}
          autoComplete="tel"
        />

        <Input
          label="Email (optional)"
          type="email"
          value={form.email}
          onChange={(event) => set('email')(event.target.value)}
          autoComplete="email"
        />

        {!isEditing ? (
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(event) => set('password')(event.target.value)}
            error={showErrors ? errors.password : undefined}
            hint="At least 8 characters, with a letter and a number."
            autoComplete="new-password"
          />
        ) : null}

        <SelectField
          label="Store"
          placeholder="Choose a store"
          value={form.storeId}
          onChange={(event) => set('storeId')(event.target.value)}
          error={showErrors ? errors.storeId : undefined}
          options={stores.map((store) => ({
            value: store.id,
            label: store.isActive ? store.name : store.name + ' (inactive)',
          }))}
          hint="They will only ever see this store's orders and stock."
        />
      </div>
    </Modal>
  );
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Lock, Mail, Phone, User } from 'lucide-react';
import { AuthLink, AuthPanel } from '@/components/layout/auth-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRegister } from '@/features/auth/auth.hooks';
import { useT } from '@/i18n';
import {
  registerSchema,
  type RegisterInput,
  type RegisterValues,
} from '@/lib/validation/auth.schema';

export default function RegisterPage() {
  const t = useT();
  const createAccount = useRegister('/');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput, unknown, RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', phone: '', password: '', email: '' },
  });

  return (
    <AuthPanel
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      footer={
        <>
          {t('auth.register.footerHave')}{' '}
          <AuthLink href="/login">{t('auth.login.submit')}</AuthLink>
        </>
      }
    >
      <form
        onSubmit={handleSubmit((values) => createAccount.mutate(values))}
        className="gap-gutter flex flex-col"
        noValidate
      >
        <Input
          label={t('auth.register.fullName')}
          autoComplete="name"
          placeholder={t('auth.register.namePlaceholder')}
          leadingIcon={<User className="size-5" />}
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        <Input
          label={t('auth.login.mobile')}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="0300 1234567"
          hint={t('auth.register.mobileHint')}
          leadingIcon={<Phone className="size-5" />}
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Input
          label={t('auth.register.email')}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          leadingIcon={<Mail className="size-5" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label={t('auth.login.password')}
          type="password"
          autoComplete="new-password"
          placeholder={t('auth.register.passwordPlaceholder')}
          hint={t('auth.register.passwordHint')}
          leadingIcon={<Lock className="size-5" />}
          error={errors.password?.message}
          {...register('password')}
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          isLoading={createAccount.isPending}
          className="mt-tight"
        >
          {t('auth.register.submit')}
        </Button>
      </form>
    </AuthPanel>
  );
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Lock, Phone } from 'lucide-react';
import { AuthLink, AuthPanel } from '@/components/layout/auth-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLogin } from '@/features/auth/auth.hooks';
import { useT } from '@/i18n';
import { loginSchema, type LoginInput, type LoginValues } from '@/lib/validation/auth.schema';

export default function LoginPage() {
  const t = useT();
  const login = useLogin('/');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  });

  return (
    <AuthPanel
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.footerNew')}{' '}
          <AuthLink href="/register">{t('auth.login.createLink')}</AuthLink>
        </>
      }
    >
      <form
        onSubmit={handleSubmit((values) => login.mutate(values))}
        className="gap-gutter flex flex-col"
        noValidate
      >
        <Input
          label={t('auth.login.mobile')}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="0300 1234567"
          leadingIcon={<Phone className="size-5" />}
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Input
          label={t('auth.login.password')}
          type="password"
          autoComplete="current-password"
          placeholder={t('auth.login.passwordPlaceholder')}
          leadingIcon={<Lock className="size-5" />}
          error={errors.password?.message}
          {...register('password')}
        />

        <Button type="submit" size="lg" fullWidth isLoading={login.isPending} className="mt-tight">
          {t('auth.login.submit')}
        </Button>
      </form>
    </AuthPanel>
  );
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Lock, Phone } from 'lucide-react';
import { AuthLink, AuthPanel } from '@/components/layout/auth-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLogin } from '@/features/auth/auth.hooks';
import { loginSchema, type LoginInput, type LoginValues } from '@/lib/validation/auth.schema';

export default function LoginPage() {
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
      title="Welcome back"
      subtitle="Sign in with the mobile number you shop with."
      footer={
        <>
          New to FreshCarts? <AuthLink href="/register">Create an account</AuthLink>
        </>
      }
    >
      <form
        onSubmit={handleSubmit((values) => login.mutate(values))}
        className="gap-gutter flex flex-col"
        noValidate
      >
        <Input
          label="Mobile number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="0300 1234567"
          leadingIcon={<Phone className="size-5" />}
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          leadingIcon={<Lock className="size-5" />}
          error={errors.password?.message}
          {...register('password')}
        />

        <Button type="submit" size="lg" fullWidth isLoading={login.isPending} className="mt-tight">
          Sign in
        </Button>
      </form>
    </AuthPanel>
  );
}

'use client';

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Lock, Phone } from 'lucide-react';
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
    <main id="main-content" className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-page py-lg">
      <header className="flex flex-col gap-xs pt-lg pb-lg">
        <h1 className="text-2xl font-bold text-primary">Welcome back</h1>
        <p className="text-base text-text-muted">
          Sign in with the mobile number you shop with.
        </p>
      </header>

      <form
        onSubmit={handleSubmit((values) => login.mutate(values))}
        className="flex flex-col gap-gutter"
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

        <Button type="submit" size="lg" fullWidth isLoading={login.isPending} className="mt-xs">
          Sign in
        </Button>
      </form>

      <p className="mt-lg text-center text-base text-text-muted">
        New to FreshCarts?{' '}
        <Link href="/register" className="font-semibold text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}

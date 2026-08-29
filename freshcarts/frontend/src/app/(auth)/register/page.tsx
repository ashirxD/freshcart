'use client';

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Lock, Mail, Phone, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRegister } from '@/features/auth/auth.hooks';
import {
  registerSchema,
  type RegisterInput,
  type RegisterValues,
} from '@/lib/validation/auth.schema';

export default function RegisterPage() {
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
    <main id="main-content" className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-page py-lg">
      <header className="flex flex-col gap-xs pt-lg pb-lg">
        <h1 className="text-2xl font-bold text-primary">Create your account</h1>
        <p className="text-base text-text-muted">
          It takes a minute. You only need a mobile number.
        </p>
      </header>

      <form
        onSubmit={handleSubmit((values) => createAccount.mutate(values))}
        className="flex flex-col gap-gutter"
        noValidate
      >
        <Input
          label="Full name"
          autoComplete="name"
          placeholder="Ayesha Khan"
          leadingIcon={<User className="size-5" />}
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        <Input
          label="Mobile number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="0300 1234567"
          hint="We use this to confirm your orders."
          leadingIcon={<Phone className="size-5" />}
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Input
          label="Email (optional)"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          leadingIcon={<Mail className="size-5" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          hint="Use at least 8 characters with a letter and a number."
          leadingIcon={<Lock className="size-5" />}
          error={errors.password?.message}
          {...register('password')}
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          isLoading={createAccount.isPending}
          className="mt-xs"
        >
          Create account
        </Button>
      </form>

      <p className="mt-lg text-center text-base text-text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}

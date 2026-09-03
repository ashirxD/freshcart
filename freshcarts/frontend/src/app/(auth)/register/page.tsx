'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Lock, Mail, Phone, User } from 'lucide-react';
import { AuthLink, AuthPanel } from '@/components/layout/auth-panel';
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
    <AuthPanel
      title="Create your account"
      subtitle="It takes a minute. You only need a mobile number."
      footer={
        <>
          Already have an account? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <form
        onSubmit={handleSubmit((values) => createAccount.mutate(values))}
        className="gap-gutter flex flex-col"
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
          className="mt-tight"
        >
          Create account
        </Button>
      </form>
    </AuthPanel>
  );
}

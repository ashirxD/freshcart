import Link from 'next/link';
import { Compass } from 'lucide-react';
import type { Metadata } from 'next';
import { Logo } from '@/components/brand/logo';
import { buttonClasses } from '@/components/ui/button';
import { getT } from '@/i18n/server';

/**
 * The root 404.
 *
 * Deliberately standalone rather than wrapped in the customer shell: this is
 * also what a signed-out visitor with a stale link sees, and it must render
 * without any of the providers a route group's layout supplies. That is why the
 * buttons come from `buttonClasses` rather than from ButtonLink — the classes
 * are shared, the component tree is not.
 *
 * No database id is echoed back. "We could not find that page" is the whole
 * truth a visitor needs; the id they typed tells them nothing.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('meta.notFoundTitle') };
}

export default async function NotFound() {
  const t = await getT();

  return (
    <main className="bg-cream px-page flex min-h-dvh flex-col items-center justify-center text-center">
      <Logo className="mb-wide" />

      <span className="bg-surface ring-sand text-primary mb-gutter flex size-16 items-center justify-center rounded-2xl ring-1">
        <Compass className="size-7" aria-hidden="true" />
      </span>

      <h1 className="text-display text-primary">{t('notFound.heading')}</h1>

      <p className="text-text-muted mt-tight max-w-sm text-sm">{t('notFound.body')}</p>

      <div className="gap-snug mt-loose flex flex-wrap items-center justify-center">
        <Link href="/" className={buttonClasses({ size: 'lg' })}>
          {t('notFound.goHome')}
        </Link>

        <Link href="/categories" className={buttonClasses({ variant: 'outline', size: 'lg' })}>
          {t('common.browseAisles')}
        </Link>
      </div>
    </main>
  );
}

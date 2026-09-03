import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { buttonClasses } from '@/components/ui/button';

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
export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="bg-cream px-page flex min-h-dvh flex-col items-center justify-center text-center">
      <Logo className="mb-wide" />

      <span className="bg-surface ring-sand text-primary mb-gutter flex size-16 items-center justify-center rounded-2xl ring-1">
        <Compass className="size-7" aria-hidden="true" />
      </span>

      <h1 className="text-display text-primary">We could not find that page</h1>

      <p className="text-text-muted mt-tight max-w-sm text-sm">
        The link may be out of date, or the page may have moved. The shop is still open.
      </p>

      <div className="gap-snug mt-loose flex flex-wrap items-center justify-center">
        <Link href="/" className={buttonClasses({ size: 'lg' })}>
          Go to FreshCarts
        </Link>

        <Link href="/categories" className={buttonClasses({ variant: 'outline', size: 'lg' })}>
          Browse the aisles
        </Link>
      </div>
    </main>
  );
}

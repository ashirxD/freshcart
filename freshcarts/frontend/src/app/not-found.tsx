import Link from 'next/link';
import { Compass } from 'lucide-react';

/**
 * The root 404.
 *
 * Deliberately standalone rather than wrapped in the customer shell: this is
 * also what a signed-out visitor with a stale link sees, and it must render
 * without any of the providers a route group's layout supplies.
 *
 * No database id is echoed back (§80). "We could not find that page" is the
 * whole truth a visitor needs; the id they typed tells them nothing.
 */
export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="bg-background px-page flex min-h-dvh flex-col items-center justify-center text-center">
      <span className="bg-surface-muted text-primary mb-gutter flex size-16 items-center justify-center rounded-full">
        <Compass className="size-7" aria-hidden="true" />
      </span>

      <h1 className="text-text text-xl font-semibold">We could not find that page</h1>

      <p className="text-text-muted mt-xs max-w-sm text-sm">
        The link may be out of date, or the page may have moved.
      </p>

      <div className="gap-gutter mt-lg flex flex-wrap items-center justify-center">
        <Link
          href="/"
          className="bg-primary text-on-primary min-h-touch px-lg inline-flex items-center rounded-full font-medium"
        >
          Go to FreshCarts
        </Link>

        <Link
          href="/categories"
          className="border-outline text-text min-h-touch px-lg inline-flex items-center rounded-full border font-medium"
        >
          Browse categories
        </Link>
      </div>
    </main>
  );
}

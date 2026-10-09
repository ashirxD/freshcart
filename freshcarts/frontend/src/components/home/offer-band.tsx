'use client';

import { ArrowRight, Tag } from 'lucide-react';
import Link from 'next/link';
import { Container } from '@/components/layout/container';
import { useProducts } from '@/features/catalog/catalog.hooks';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';

/**
 * THE PROMOTIONAL MOMENT (§30)
 *
 * §30 wants a promotional section "where real promotional data exists", and is
 * explicit that discounts must not be invented. FreshCarts has no campaign
 * model: a saving lives on a product, as a `compareAtPrice` an admin entered.
 * So the only honest promotion this app can make is to count the products that
 * are genuinely discounted right now and offer a way to them.
 *
 * That is exactly what this does. The number is the API's `pagination.total`
 * for `discounted=true` — the same query the "See all" link opens — so the band
 * cannot advertise a sale that is not there. When nothing is discounted the
 * band does not render at all, and no "up to 50% off" is ever claimed, because
 * nothing here knows what the biggest saving is.
 */
export function OfferBand() {
  const t = useT();
  // `limit: 1` because only the count is wanted: the shelf of discounted
  // products is a separate section, and this must not fetch it twice.
  const { data } = useProducts({ discounted: true, limit: 1 });

  const count = data?.pagination.total ?? 0;
  if (count === 0) return null;

  return (
    <Container className="py-loose">
      <Link
        href="/search?sale=true&sort=discount"
        className={cn(
          'group bg-primary text-cream relative flex flex-col gap-4 overflow-hidden rounded-2xl',
          'p-loose sm:flex-row sm:items-center sm:justify-between sm:p-6',
          'transition-shadow duration-200 ease-standard hover:shadow-raised',
        )}
      >
        {/* A single soft apricot wash in the corner. Not a blob: it is clipped
            by the band and sits behind the type, at low opacity. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(28rem 14rem at 100% 0%, var(--color-apricot) 0%, transparent 62%)',
            opacity: 0.28,
          }}
        />

        <div className="relative flex items-center gap-4">
          <span
            aria-hidden="true"
            className="bg-cream/12 flex size-12 shrink-0 items-center justify-center rounded-xl"
          >
            <Tag className="text-apricot size-6" />
          </span>

          <div className="flex flex-col gap-1">
            <p className="text-eyebrow text-apricot uppercase">{t('home.offer.eyebrow')}</p>
            <p className="text-display text-cream">
              {t('home.offer.count', { count })}
            </p>
            <p className="text-cream/70 text-sm">
              {t('home.offer.body')}
            </p>
          </div>
        </div>

        <span className="bg-cream text-primary relative flex min-h-12 shrink-0 items-center gap-2 rounded-lg px-5 text-sm font-bold">
          {t('home.offer.cta')}
          <ArrowRight
            className="size-4 transition-transform duration-200 ease-standard group-hover:translate-x-0.5 rtl:rotate-180"
            aria-hidden="true"
          />
        </span>
      </Link>
    </Container>
  );
}

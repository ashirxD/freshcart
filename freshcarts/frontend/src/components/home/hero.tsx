'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ScanLine, Store, Truck } from 'lucide-react';
import { SearchBar } from '@/components/common/search-bar';
import { Container } from '@/components/layout/container';
import { ButtonLink } from '@/components/ui/button-link';
import { useCurrentStore } from '@/features/catalog/catalog.hooks';
import { cn } from '@/lib/cn';
import { useScanAvailability } from '@/features/scan/scan.hooks';
import { useAuthStore } from '@/store/auth.store';
import { HeroBasket } from './hero-basket';

/**
 * Roman-Urdu quick searches.
 *
 * These are SEARCH TERMS, not claims about the catalogue: each is a query the
 * shopper could have typed, and it goes to the same results page. They matter
 * more than they look (§60, §78) — the shoppers this app is for think in
 * "atta" and "doodh", and one tap is a great deal easier than spelling either
 * on a phone keyboard. The catalogue's own `searchTerms` already index these,
 * so they return real results rather than empty pages.
 */
const QUICK_SEARCHES = ['atta', 'doodh', 'cheeni', 'sabzi', 'anday', 'chai'];

/**
 * THE HERO (§11, §15)
 *
 * The old storefront opened with a greeting, a search field and a wall of
 * white. This is the first viewport doing actual work: what this is, where it
 * delivers from, the one thing most shoppers want to do (search), the one thing
 * that makes FreshCarts different (scan a list), and a picture of groceries.
 *
 * The copy is about groceries, not about technology. There is no "AI-powered"
 * anything in it — the scanner is described by what it does for the shopper.
 *
 * Nothing here is invented: the shop's name and area come from the store
 * record, and the scan button is absent entirely when the OCR service is down,
 * so nobody is offered a feature that cannot run.
 */
export function Hero() {
  const router = useRouter();
  const { data: store } = useCurrentStore();
  const { data: scan } = useScanAvailability();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  // A local greeting when we know who this is, and where they are shopping when
  // we do not. The line is never empty, so the heading below never shifts.
  const eyebrow =
    status === 'authenticated' && user
      ? 'Assalam-o-Alaikum, ' + user.fullName.split(' ')[0]
      : store
        ? 'Your neighbourhood grocery in ' + store.address.area
        : 'Your neighbourhood grocery';

  return (
    <section className="bg-cream relative overflow-hidden" aria-labelledby="hero-heading">
      {/*
        A warm wash that lifts the top of the page without being a gradient
        anybody would notice. Two soft radial tints, clipped by the section.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(60rem 24rem at 85% -10%, var(--color-peach) 0%, transparent 60%),' +
            'radial-gradient(40rem 20rem at 0% 110%, var(--color-sand) 0%, transparent 55%)',
        }}
      />

      <Container className="py-loose relative md:py-14">
        <div className="items-center gap-8 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div className="flex flex-col gap-5">
            <p className="text-eyebrow text-leaf uppercase">{eyebrow}</p>

            <h1 id="hero-heading" className="text-hero text-primary max-w-xl">
              Your everyday groceries,
              <br />
              without the everyday hassle.
            </h1>

            <p className="text-text-muted max-w-md text-base leading-relaxed sm:text-lg">
              Fresh produce, pantry staples and daily essentials
              {store ? ' from ' + store.name : ''} — brought to your door, or packed and waiting
              when you arrive.
            </p>

            <div className="gap-snug mt-1 flex flex-col">
              <SearchBar
                variant="hero"
                onSubmit={(term) => router.push('/search?q=' + encodeURIComponent(term))}
                className="max-w-lg"
              />

              {/* One-tap Roman-Urdu searches, directly under the field they
                  would otherwise have to be typed into. The last two are
                  hidden on a phone, where six chips wrap onto a second row and
                  push the aisles another 30px down the page. */}
              <div className="gap-tight flex flex-wrap items-center">
                <span className="text-text-muted text-xs font-semibold">Try:</span>
                {QUICK_SEARCHES.map((term, index) => (
                  <Link
                    key={term}
                    href={'/search?q=' + encodeURIComponent(term)}
                    className={cn(
                      'bg-surface/70 text-text ring-sand hover:bg-surface hover:ring-leaf/40',
                      // 44px on a phone, where this is a thumb target; the
                      // chip relaxes to its natural height from `sm` up, where
                      // it is a cursor target sitting in a tidy row (§54).
                      'inline-flex min-h-11 items-center rounded-full px-3 text-xs font-semibold',
                      'ring-1 transition-[background-color,box-shadow] sm:min-h-8 sm:px-2.5',
                      index >= 4 && 'hidden sm:inline-flex',
                    )}
                  >
                    {term}
                  </Link>
                ))}
              </div>
            </div>

            <div className="gap-tight mt-2 flex flex-wrap items-center">
              {/* Absent when the scanner cannot run — never a button that
                  apologises after it is pressed. */}
              {scan?.available ? (
                <ButtonLink
                  href="/scan"
                  variant="secondary"
                  leadingIcon={<ScanLine className="size-5" aria-hidden="true" />}
                >
                  Scan your list
                </ButtonLink>
              ) : null}

              <ButtonLink href="/categories" variant="outline">
                Browse the aisles
              </ButtonLink>
            </div>

            {/* Hidden on a phone: the same two facts are stated in full in the
                service section, and above the fold they cost more height than
                they earn. */}
            <ul className="text-text-muted gap-x-loose gap-y-tight mt-2 hidden flex-wrap text-xs font-medium sm:flex">
              <li className="flex items-center gap-1.5">
                <Truck className="text-leaf size-4" aria-hidden="true" />
                Delivery charge shown before you order
              </li>
              <li className="flex items-center gap-1.5">
                <Store className="text-leaf size-4" aria-hidden="true" />
                Or collect from the shop, free
              </li>
            </ul>
          </div>

          {/* The illustration is the second half of the composition on desktop
              and a smaller anchor above the fold on a phone. */}
          <div className="mt-6 flex justify-center lg:mt-0">
            <HeroBasket className="max-w-[13rem] sm:max-w-sm lg:max-w-md" />
          </div>
        </div>
      </Container>
    </section>
  );
}

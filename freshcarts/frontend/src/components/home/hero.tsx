'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Clock, ScanLine, Search, Store, type LucideIcon } from 'lucide-react';
import { SearchBar } from '@/components/common/search-bar';
import { Container } from '@/components/layout/container';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { LanguageToggle } from '@/components/common/language-toggle';
import { useCurrentStore } from '@/features/catalog/catalog.hooks';
import { useI18n, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/cn';
import { describeHours, hoursForDay, useTodayIndex } from '@/lib/hours';
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
 * How shopping here works, as three facts that are true of this shop: you can
 * search (or scan, when the scanner is up), there are two ways to receive an
 * order, and nothing is paid until it arrives. Each one is stated in full further down the page; this is
 * the first viewport answering "how do I use this?" before it is asked.
 */
function stepsFor(canScan: boolean): Array<{ icon: LucideIcon; labelKey: TranslationKey }> {
  return [
    // Never promises a scanner that is switched off.
    canScan
      ? { icon: ScanLine, labelKey: 'home.hero.stepSearchOrScan' }
      : { icon: Search, labelKey: 'home.hero.stepSearchOnly' },
    { icon: Store, labelKey: 'home.hero.stepDeliveryOrCollect' },
    { icon: Clock, labelKey: 'home.hero.stepPayCash' },
  ];
}

/**
 * THE HERO (§11, §15)
 *
 * The old storefront opened with a greeting, a search field and a wall of
 * white. This is the first viewport doing actual work: what this is, where it
 * delivers from, the one thing most shoppers want to do (search), the one thing
 * that makes FreshCarts different (scan a list), how it works, and a picture of
 * groceries with the real shop standing on it.
 *
 * The copy is about groceries, not about technology. There is no "AI-powered"
 * anything in it — the scanner is described by what it does for the shopper.
 *
 * Nothing here is invented: the shop's name, area and hours come from the store
 * record, and everything about the scanner is absent entirely when the OCR
 * service is down, so nobody is offered a feature that cannot run.
 */
export function Hero() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: store } = useCurrentStore();
  const { data: scan } = useScanAvailability();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  // A local greeting when we know who this is, and where they are shopping when
  // we do not. The line is never empty, so the heading below never shifts.
  const eyebrow =
    status === 'authenticated' && user
      ? t('home.hero.eyebrowGreeting', { name: user.fullName.split(' ')[0] })
      : store
        ? t('home.hero.eyebrowLocal', { area: store.address.area })
        : t('home.hero.eyebrowDefault');

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
        <div className="items-center gap-8 lg:grid lg:grid-cols-[1.12fr_0.88fr] lg:gap-10">
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-eyebrow text-leaf uppercase">{eyebrow}</p>
              {/* The language toggle lives on the home screen, where a shopper
                  lands — compact, and out of the navigation bar. */}
              <LanguageToggle size="sm" className="shrink-0" />
            </div>

            {/* One short line, on purpose: the first thing a shopper sees should
                be the search field, not a paragraph about the shop. */}
            <h1 id="hero-heading" className="text-display lg:text-section text-primary">
              {t('home.hero.title')}
            </h1>

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
                <span className="text-text-muted text-xs font-semibold">{t('home.hero.try')}</span>
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
                  {t('home.hero.scanCta')}
                </ButtonLink>
              ) : null}

              <ButtonLink href="/categories" variant="outline">
                {t('home.hero.browse')}
              </ButtonLink>
            </div>

            {/* Hidden on a phone: the same facts are stated in full in the
                service section, and above the fold they cost more height than
                they earn. */}
            <ol className="text-text-muted gap-x-loose gap-y-tight mt-3 hidden flex-wrap text-xs font-semibold sm:flex">
              {stepsFor(Boolean(scan?.available)).map((step, index) => {
                const Icon = step.icon;

                return (
                  <li key={step.labelKey} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="bg-surface text-leaf ring-sand flex size-7 items-center justify-center rounded-full ring-1"
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span>
                      <span className="sr-only">{t('home.hero.stepNumber', { number: index + 1 })} </span>
                      {t(step.labelKey)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* The picture is the second half of the composition. On a phone it is
              a smaller anchor; from `lg` the real shop — and the scanner — sit
              in a row beneath it, which puts them in the first viewport without
              laying anything over the artwork. */}
          <div className="mx-auto mt-6 flex w-full max-w-md flex-col items-center gap-4 lg:mt-0 lg:max-w-lg">
            <HeroBasket className="max-w-[13rem] sm:max-w-sm lg:max-w-md" />

            <div
              className={cn(
                'hidden w-full gap-3 lg:-mt-5 lg:grid',
                scan?.available ? 'lg:grid-cols-2' : 'lg:mx-auto lg:max-w-xs',
              )}
            >
              <ShopCard />
              {scan?.available ? <ScanCard /> : null}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * The shop, standing next to its own groceries: name, area and today's hours,
 * all from the store record. A fixed-height skeleton holds its place while the
 * record loads, and the card is absent if the record never arrives — nothing is
 * filled in from memory.
 */
function ShopCard({ className }: { className?: string }) {
  const { t, ltr } = useI18n();
  const { data: store, isPending } = useCurrentStore();
  const today = useTodayIndex();
  const todayRow = hoursForDay(store?.openingHours, today);
  const hours = describeHours(todayRow, t('common.closed'));

  if (!isPending && !store) return null;

  return (
    <div
      className={cn(
        'bg-surface shadow-raised ring-outline-variant/70 animate-fade-up flex items-start gap-3 rounded-xl p-3.5 ring-1',
        className,
      )}
      style={{ animationDelay: '140ms' }}
    >
      <span
        aria-hidden="true"
        className="bg-leaf/12 text-success flex size-10 shrink-0 items-center justify-center rounded-xl"
      >
        <Store className="size-5" />
      </span>

      {store ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-card text-text">{store.name}</p>
          {/* Absent until mounted: the weekday cannot be known on the server,
              and a line that says "closed" when it is open is worse than none. */}
          {hours ? (
            <p className="text-text-muted text-xs font-medium">
              {todayRow?.isClosed
                ? t('home.hero.closedToday')
                : t('home.hero.openToday', { hours: ltr(hours) })}
            </p>
          ) : (
            <p className="text-text-muted text-xs font-medium">{store.address.area}</p>
          )}
          <p className="text-text-muted truncate text-xs">
            {store.address.line1}, {store.address.area}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-3/4" label={t('home.hero.loadingShop')} />
          <Skeleton className="h-3 w-1/2" />
        </div>
      )}
    </div>
  );
}

/** The scanner, offered where the eye already is. A link, so it is one tap. */
function ScanCard({ className }: { className?: string }) {
  const { t } = useI18n();

  return (
    <Link
      href="/scan"
      className={cn(
        'group bg-peach shadow-raised ring-apricot/40 animate-fade-up flex items-center gap-3 rounded-xl p-3.5 ring-1',
        'ease-standard transition-transform duration-200 hover:-translate-y-0.5',
        className,
      )}
      style={{ animationDelay: '240ms' }}
    >
      <span
        aria-hidden="true"
        className="bg-surface text-attention flex size-10 shrink-0 items-center justify-center rounded-xl"
      >
        <ScanLine className="size-5" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-text text-sm leading-tight font-bold">
          {t('home.hero.scanCardTitle')}
        </span>
        <span className="text-text/70 text-xs leading-snug">
          {t('home.hero.scanCardBody')}
        </span>
      </span>

      <ArrowRight
        className="text-attention ease-standard size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

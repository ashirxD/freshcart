'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Clock, MapPin, Phone, Store, Truck } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { LanguageToggle } from '@/components/common/language-toggle';
import { Ltr } from '@/components/common/ltr';
import { useCategories, useCurrentStore } from '@/features/catalog/catalog.hooks';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { describeHours, hoursForDay, useTodayIndex } from '@/lib/hours';

/**
 * THE FOOTER (§58)
 *
 * The app had none, which is part of why every page just stopped. A deep-leaf
 * band closes the page and gives the whole layout a bottom edge — the last of
 * the background zones (§57).
 *
 * EVERYTHING IN IT IS REAL
 * The aisles come from the categories endpoint, and the shop's address, phone
 * and today's hours come from the store record. There are no invented social
 * accounts, no press page, no "About us" that does not exist, and no newsletter
 * signup with nothing behind it — a footer full of dead links is worse than a
 * short one (§71).
 *
 * Hidden on mobile: a phone already has the tab bar and the basket bar at the
 * foot of the screen, and a third stack of links under them is just distance
 * between the shopper and the next product.
 */
export function SiteFooter() {
  const { data: store } = useCurrentStore();
  const { data: categories } = useCategories();
  const { t, ltr } = useI18n();

  const aisles = (categories ?? []).slice(0, 6);

  const today = useTodayIndex();
  const openToday = describeHours(hoursForDay(store?.openingHours, today), t('common.closed'));

  return (
    <footer className="bg-primary text-cream mt-auto hidden md:block">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-8 py-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        {/* --- Who we are ---------------------------------------------- */}
        <div className="flex flex-col gap-3">
          <Logo tone="onDark" />

          <p className="text-cream/70 max-w-xs text-sm leading-relaxed">
            {store?.description ?? t('footer.defaultAbout')}
          </p>

          <div className="mt-1 flex flex-wrap gap-2">
            <FooterFlag icon={<Truck className="size-3.5" />}>{t('footer.homeDelivery')}</FooterFlag>
            <FooterFlag icon={<Store className="size-3.5" />}>{t('footer.collectInStore')}</FooterFlag>
          </div>
        </div>

        {/* --- Shopping ------------------------------------------------ */}
        <FooterColumn title={t('footer.shopping')}>
          <FooterLink href="/categories">{t('footer.allCategories')}</FooterLink>
          <FooterLink href="/search?sale=true&sort=discount">{t('footer.onOffer')}</FooterLink>
          <FooterLink href="/search?sort=newest">{t('footer.newInStore')}</FooterLink>
          <FooterLink href="/scan">{t('footer.scanList')}</FooterLink>
        </FooterColumn>

        {/* --- Aisles, from the catalogue ------------------------------ */}
        {aisles.length > 0 ? (
          <FooterColumn title={t('footer.aisles')}>
            {aisles.map((category) => (
              <FooterLink key={category.id} href={'/categories/' + category.slug}>
                {category.name}
              </FooterLink>
            ))}
          </FooterColumn>
        ) : (
          <FooterColumn title={t('footer.yourAccount')}>
            <FooterLink href="/orders">{t('footer.yourOrders')}</FooterLink>
            <FooterLink href="/favorites">{t('footer.savedItems')}</FooterLink>
            <FooterLink href="/addresses">{t('footer.deliveryAddresses')}</FooterLink>
            <FooterLink href="/cart">{t('footer.yourBasket')}</FooterLink>
          </FooterColumn>
        )}

        {/* --- The shop itself ----------------------------------------- */}
        <div className="flex flex-col gap-3">
          <h2 className="text-eyebrow text-apricot uppercase">{t('footer.visitTheShop')}</h2>

          {store ? (
            <address className="text-cream/75 flex flex-col gap-2.5 text-sm not-italic">
              <span className="flex items-start gap-2">
                <MapPin className="text-apricot mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {store.address.line1}, {store.address.area}
                  <br />
                  {store.address.city}
                </span>
              </span>

              <a
                href={'tel:' + store.phone}
                className="hover:text-cream flex min-h-11 items-center gap-2 transition-colors"
              >
                <Phone className="text-apricot size-4 shrink-0" aria-hidden="true" />
                <Ltr>{store.phone}</Ltr>
              </a>

              {openToday ? (
                <span className="flex items-center gap-2">
                  <Clock className="text-apricot size-4 shrink-0" aria-hidden="true" />
                  {t('footer.openToday', { hours: ltr(openToday) })}
                </span>
              ) : null}
            </address>
          ) : null}
        </div>
      </div>

      <div className="border-cream/15 border-t">
        <div className="text-cream/55 mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-8 py-4 text-xs">
          <p>{t('footer.copyright', { year: FOUNDED_YEAR })}</p>
          <p>{t('footer.deliveryChargeNote')}</p>
          <LanguageToggle tone="onDark" size="sm" />
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-eyebrow text-apricot uppercase">{title}</h2>
      <ul className="flex flex-col gap-1">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-cream/75 hover:text-cream flex min-h-9 items-center text-sm transition-colors"
      >
        {children}
      </Link>
    </li>
  );
}

function FooterFlag({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span
      className={cn(
        'bg-cream/10 text-cream/85 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
      )}
    >
      <span className="text-apricot" aria-hidden="true">
        {icon}
      </span>
      {children}
    </span>
  );
}

/**
 * Fixed rather than `new Date().getFullYear()`: a year computed at render time
 * is one more value that can differ between the server and the browser, for no
 * benefit anyone reading a footer would notice.
 */
const FOUNDED_YEAR = 2026;

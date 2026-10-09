'use client';

import type { ReactNode } from 'react';
import { Clock, MapPin, Phone, ReceiptText, Store, Truck } from 'lucide-react';
import { SectionHeader } from '@/components/common/section-header';
import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentStore } from '@/features/catalog/catalog.hooks';
import { Ltr } from '@/components/common/ltr';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { describeHours, hoursForDay, useTodayIndex } from '@/lib/hours';

/**
 * HOW THE SERVICE WORKS (§11, §30)
 *
 * §30 asks for a promotional moment where real promotional data exists, and a
 * service section where it does not. There are no store-wide campaigns in this
 * product — a discount lives on a product, not on a banner — so this is the
 * service section, and it is built entirely from things that are true:
 *
 *   Delivery — priced from the road distance to the shopper's own address,
 *              which is exactly what checkout does.
 *   Pickup   — the real shop, at its real address, with no charge.
 *   Hours    — the store's own opening schedule.
 *   Payment  — cash on delivery, which is how this shop takes money.
 *
 * There are no invented statistics anywhere in it: no "10,000 happy
 * customers", no star ratings, no delivery-time promise the routing provider
 * cannot actually make (§71).
 */
export function ServicePanel() {
  const t = useT();
  const { data: store, isPending } = useCurrentStore();
  const today = useTodayIndex();
  const openToday = describeHours(hoursForDay(store?.openingHours, today), t('common.closed'));

  return (
    <section className="bg-surface-muted py-wide md:py-section">
      <Container className="gap-loose flex flex-col">
        <SectionHeader
          eyebrow={t('home.service.eyebrow')}
          title={t('home.service.title')}
          subtitle={t('home.service.subtitle')}
          accent="teal"
          className="max-w-2xl"
        />

        <div className="gap-gutter grid sm:grid-cols-2 lg:grid-cols-4">
          <ServiceCard
            icon={<Truck className="size-5" />}
            title={t('home.service.deliveredTitle')}
            tone="leaf"
          >
            {t('home.service.deliveredBody')}
          </ServiceCard>

          <ServiceCard
            icon={<Store className="size-5" />}
            title={t('home.service.collectTitle')}
            tone="teal"
          >
            {store
              ? t('home.service.collectBodyStore', { store: store.name, area: store.address.area })
              : t('home.service.collectBodyGeneric')}
          </ServiceCard>

          <ServiceCard
            icon={<ReceiptText className="size-5" />}
            title={t('home.service.payTitle')}
            tone="offer"
          >
            {t('home.service.payBody')}
          </ServiceCard>

          <ServiceCard
            icon={<Clock className="size-5" />}
            title={t('home.service.openTitle')}
            tone="berry"
          >
            {isPending ? (
              <Skeleton className="h-10 w-full" label={t('home.service.loadingHours')} />
            ) : store ? (
              <span className="flex flex-col gap-1.5">
                {openToday ? (
                  <Ltr className="text-text font-semibold">{openToday}</Ltr>
                ) : null}

                <span className="flex items-start gap-1.5">
                  <MapPin className="text-outline mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {store.address.line1}, {store.address.area}
                  </span>
                </span>

                <a
                  href={'tel:' + store.phone}
                  className="text-primary flex min-h-11 items-center gap-1.5 font-semibold"
                >
                  <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                  <Ltr>{store.phone}</Ltr>
                </a>
              </span>
            ) : null}
          </ServiceCard>
        </div>
      </Container>
    </section>
  );
}

const TONES = {
  leaf: 'bg-leaf/12 text-success',
  teal: 'bg-teal/12 text-info',
  offer: 'bg-apricot/25 text-attention',
  berry: 'bg-berry/12 text-berry',
} as const;

function ServiceCard({
  icon,
  title,
  tone,
  children,
}: {
  icon: ReactNode;
  title: string;
  tone: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <article className="ring-outline-variant bg-surface p-gutter gap-snug shadow-card flex flex-col rounded-xl ring-1">
      <span
        aria-hidden="true"
        className={cn('flex size-11 items-center justify-center rounded-xl', TONES[tone])}
      >
        {icon}
      </span>

      <h3 className="text-text text-card">{title}</h3>
      {/* A div, not a p: the hours card holds a skeleton and block content, and
          a div inside a p is invalid HTML that browsers re-parent, which then
          fails hydration against the server markup. */}
      <div className="text-text-muted text-sm leading-relaxed">{children}</div>
    </article>
  );
}

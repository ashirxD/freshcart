'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Clock, ScanLine, Truck } from 'lucide-react';
import { LogoLink } from '@/components/brand/logo';
import { LanguageToggle } from '@/components/common/language-toggle';
import { HeroBasket } from '@/components/home/hero-basket';
import { useT } from '@/i18n';

export interface AuthPanelProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** The "already have an account?" line under the form. */
  footer: ReactNode;
}

/**
 * THE SIGN-IN / SIGN-UP LAYOUT
 *
 * The auth screens sit outside the shopping chrome on purpose — no tab bar, no
 * basket, nothing to wander off into — which used to leave them as a bare form
 * on a white page with no indication of what they belonged to.
 *
 * So: the form on the left at a comfortable reading width, and on a desktop a
 * deep-leaf panel on the right carrying the brand, the illustration and three
 * plain statements about the service. Nothing in that panel is a claim about
 * numbers or popularity (§71) — it says what FreshCarts does, which is all a
 * person signing in needs to know.
 *
 * On a phone the panel is gone entirely and the mark moves above the heading:
 * a decorative half-screen is the last thing wanted above a keyboard.
 */
export function AuthPanel({ title, subtitle, children, footer }: AuthPanelProps) {
  const t = useT();

  return (
    <main id="main-content" className="grid min-h-dvh lg:grid-cols-2">
      <div className="px-page py-wide flex flex-col md:px-8">
        <div className="mb-wide flex items-center justify-between gap-3">
          <LogoLink size="md" className="min-h-11 w-fit items-center" />
          {/* A guest picks their language here, before there is an account to
              remember it on. */}
          <LanguageToggle size="sm" />
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <header className="gap-tight mb-wide flex flex-col">
            <h1 className="text-display text-primary">{title}</h1>
            <p className="text-text-muted text-base">{subtitle}</p>
          </header>

          {children}

          <p className="mt-wide text-text-muted text-center text-base">{footer}</p>
        </div>
      </div>

      {/* Desktop only: the brand half. */}
      <aside className="bg-primary text-cream relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-center">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(36rem 20rem at 80% 0%, var(--color-leaf) 0%, transparent 65%)',
            opacity: 0.55,
          }}
        />

        <div className="relative flex flex-col items-center gap-8 px-12">
          <HeroBasket tone="dark" className="max-w-sm" />

          <div className="flex max-w-sm flex-col gap-3 text-center">
            <p className="text-display text-cream">{t('authPanel.tagline')}</p>

            <ul className="text-cream/75 gap-tight mt-2 flex flex-col text-sm">
              <li className="flex items-center justify-center gap-2">
                <Truck className="text-apricot size-4 shrink-0" aria-hidden="true" />
                {t('authPanel.pointDelivery')}
              </li>
              <li className="flex items-center justify-center gap-2">
                <ScanLine className="text-apricot size-4 shrink-0" aria-hidden="true" />
                {t('authPanel.pointScan')}
              </li>
              <li className="flex items-center justify-center gap-2">
                <Clock className="text-apricot size-4 shrink-0" aria-hidden="true" />
                {t('authPanel.pointCharge')}
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </main>
  );
}

/** The link pattern shared by both auth screens' footers. */
export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-primary font-bold underline-offset-4 transition-colors hover:underline"
    >
      {children}
    </Link>
  );
}

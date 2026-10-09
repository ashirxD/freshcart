'use client';

import { useLanguageSwitch } from '@/features/locale/use-language-switch';
import { LOCALES, LOCALE_NAMES, useT } from '@/i18n';
import { cn } from '@/lib/cn';

export interface LanguageToggleProps {
  /** `onDark` is for the deep-green footer and the dark panels. */
  tone?: 'default' | 'onDark';
  size?: 'sm' | 'md';
  className?: string;
}

const TONES = {
  default: {
    group: 'bg-surface-muted ring-outline-variant',
    active: 'bg-primary text-on-primary shadow-card',
    idle: 'text-text-muted hover:text-text',
  },
  onDark: {
    group: 'bg-cream/10 ring-cream/20',
    active: 'bg-cream text-primary shadow-card',
    idle: 'text-cream/75 hover:text-cream',
  },
} as const;

const SIZES = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-11 px-4 text-sm',
} as const;

/**
 * English | اردو
 *
 * A two-way segmented control, not a dropdown: with two languages a menu is one
 * extra tap for nothing, and both names should be visible so nobody has to know
 * which script to look for. Each name is written in its own language and tagged
 * with its own `lang`, so a screen reader pronounces it properly.
 *
 * The group is pinned left-to-right whichever language is active. The order a
 * visitor sees — English first — then never changes under their thumb when they
 * switch, and "the active one is the filled one" is the only signal they need.
 *
 * Switching re-renders in place: nothing remounts, so the basket, the session,
 * an address half-typed into checkout and the scroll position all survive.
 */
export function LanguageToggle({ tone = 'default', size = 'md', className }: LanguageToggleProps) {
  const { locale, change } = useLanguageSwitch();
  const t = useT();
  const styles = TONES[tone];

  return (
    <div
      role="group"
      aria-label={t('language.label')}
      dir="ltr"
      className={cn('inline-flex items-center gap-0.5 rounded-full p-0.5 ring-1', styles.group, className)}
    >
      {LOCALES.map((code) => {
        const isActive = code === locale;

        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={isActive}
            onClick={() => change(code)}
            className={cn(
              'ease-standard inline-flex items-center justify-center rounded-full font-semibold',
              'transition-[background-color,color,box-shadow] duration-200',
              SIZES[size],
              isActive ? styles.active : styles.idle,
            )}
          >
            {LOCALE_NAMES[code]}
          </button>
        );
      })}
    </div>
  );
}

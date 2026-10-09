'use client';

import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_LOCALE, directionOf, isLocale, type Direction, type Locale } from './config';
import { writeLocaleCookie } from './cookie';
import {
  createT,
  isolateLtr,
  setActiveLocale,
  translateMessage,
  translateTemplate,
  type TFunction,
  type TranslationVars,
} from './translate';
import type { TranslationKey } from './messages';

export interface LocaleContextValue {
  locale: Locale;
  dir: Direction;
  isRtl: boolean;
  /** Translates a typed key. */
  t: TFunction;
  /** Translates a message that may be a key, leaving anything else alone. */
  tm: (message: string, vars?: TranslationVars) => string;
  /**
   * Like `t`, but the values may be React nodes. Use it when a piece of the
   * sentence needs its own markup — a user's search term in `<bdi>`, a store
   * name in bold — because the translation, not the component, decides where in
   * the sentence that piece goes: "Results for “atta”" in English, "“atta” کے
   * نتائج" in Urdu.
   */
  tx: (key: TranslationKey, vars: Record<string, ReactNode>, count?: number) => ReactNode;
  /**
   * Isolates a left-to-right value (hours, a phone number, an order number) so
   * it keeps its own order when it is interpolated INTO a right-to-left
   * sentence. Does nothing in English, so English text is byte-for-byte what it
   * was. For a value that stands alone in an element, use the `Ltr` component.
   */
  ltr: (value: string | number) => string;
  /**
   * Changes the language: the screen re-renders in place (nothing remounts, so
   * no cart, form, session or scroll position is lost), the cookie is written,
   * and `<html lang dir>` follow. Use `useLanguageSwitch` instead when the
   * choice should also be saved to the signed-in user's profile.
   */
  setLocale: (next: Locale) => void;
}

const english: LocaleContextValue = {
  locale: DEFAULT_LOCALE,
  dir: directionOf(DEFAULT_LOCALE),
  isRtl: false,
  t: createT(DEFAULT_LOCALE),
  tm: (message, vars) => translateMessage(DEFAULT_LOCALE, message, vars),
  tx: (key, vars, count) => renderRich(translateTemplate(DEFAULT_LOCALE, key, count) ?? '', vars),
  ltr: (value) => String(value),
  setLocale: () => {},
};

/**
 * The default is a working English context, not `null`: a component rendered
 * without the provider (a unit test, a story) speaks English instead of
 * throwing, which is also exactly what "English unless chosen" means.
 */
const LocaleContext = createContext<LocaleContextValue>(english);

/** Splits a template on its `{placeholders}` and drops a node into each. */
function renderRich(template: string, vars: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/g).map((part, index) => {
    const match = /^\{(\w+)\}$/.exec(part);
    return match && match[1] in vars ? <Fragment key={index}>{vars[match[1]]}</Fragment> : part;
  });
}

/** How long the page dips while the words change. Matches `locale-fade` in CSS. */
const SWITCH_ANIMATION_MS = 220;

function applyToDocument(locale: Locale, animate: boolean): void {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = directionOf(locale);

  if (!animate) return;

  root.classList.add('locale-switching');
  window.setTimeout(() => root.classList.remove('locale-switching'), SWITCH_ANIMATION_MS);
}

/**
 * THE ONE AUTHORITATIVE LANGUAGE STATE.
 *
 * `initialLocale` comes from the cookie, read by the server in the root layout,
 * so the first render already agrees with the HTML the server sent. From there
 * this component owns the language; everything else — `useT`, `useLocale`, the
 * toggle, `tNow` for code outside React — derives from it and nothing keeps a
 * second copy.
 */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Keep the non-React mirror and the document in step with the state. An
  // effect, not a render-time write: effects never run on the server, which is
  // what keeps the module-level mirror from leaking between visitors.
  useEffect(() => {
    setActiveLocale(locale);
    applyToDocument(locale, false);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;

    writeLocaleCookie(next);
    setActiveLocale(next);
    applyToDocument(next, true);
    setLocaleState(next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir: directionOf(locale),
      isRtl: directionOf(locale) === 'rtl',
      t: createT(locale),
      tm: (message, vars) => translateMessage(locale, message, vars),
      tx: (key, vars, count) => renderRich(translateTemplate(locale, key, count) ?? '', vars),
      ltr: (value) => isolateLtr(locale, value),
      setLocale,
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): LocaleContextValue {
  return useContext(LocaleContext);
}

/** The translate function — what most components want. */
export function useT(): TFunction {
  return useContext(LocaleContext).t;
}

export function useLocale(): Pick<LocaleContextValue, 'locale' | 'dir' | 'isRtl' | 'setLocale'> {
  const { locale, dir, isRtl, setLocale } = useContext(LocaleContext);
  return { locale, dir, isRtl, setLocale };
}

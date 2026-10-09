'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_LOCALE, directionOf, type Locale } from '@/i18n/config';
import { readLocaleCookie } from '@/i18n/cookie';
import { createT } from '@/i18n/translate';

/**
 * The last-resort boundary: a failure in the ROOT layout itself, which the
 * route-group boundaries sit inside and therefore cannot catch.
 *
 * It must render its own <html> and <body>, because the layout that normally
 * provides them is the thing that failed. For the same reason it uses inline
 * styles rather than the design tokens — the stylesheet is loaded by that
 * layout, so a token would resolve to nothing here. The literals below are
 * the design tokens' values, copied deliberately: background, ink and the
 * brand green, kept in step with globals.css by hand because there is no
 * stylesheet at this point to read them from.
 *
 * It also sits ABOVE the locale provider, so it reads the language cookie itself
 * — after mount, never during render, so the server and client agree on the
 * first paint and English is the (briefly) shown fallback.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocale(readLocaleCookie() ?? DEFAULT_LOCALE);
  }, []);

  const t = createT(locale);

  return (
    <html lang={locale} dir={directionOf(locale)}>
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          background: '#FDFAF3',
          color: '#1B1C1C',
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          margin: 0,
        }}
      >
        <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>{t('errorPage.title')}</h1>

        <p style={{ color: '#5A5750', fontSize: '14px', maxWidth: '28rem', marginTop: '8px' }}>
          {t('errorPage.body')}
        </p>

        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '24px',
            minHeight: '48px',
            padding: '0 24px',
            borderRadius: '16px',
            border: 'none',
            background: '#00450D',
            color: '#FFFFFF',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('common.tryAgain')}
        </button>

        {error.digest ? (
          <p style={{ color: '#5A5750', fontSize: '12px', marginTop: '16px' }}>
            {t('states.reference')} <bdi dir="ltr">{error.digest}</bdi>
          </p>
        ) : null}
      </body>
    </html>
  );
}

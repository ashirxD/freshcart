import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Nastaliq_Urdu } from 'next/font/google';
import { directionOf } from '@/i18n/config';
import { getLocale, getT } from '@/i18n/server';
import { AppProviders } from '@/providers/app-providers';
import './globals.css';

/**
 * Fonts are exposed as CSS variables that globals.css maps onto the
 * `--font-sans` / `--font-urdu` design tokens, so components only ever refer to
 * the token, never to a font name.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoNastaliqUrdu = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  variable: '--font-noto-nastaliq',
  display: 'swap',
  weight: ['400', '600'],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();

  return {
    title: {
      default: t('meta.siteTitle'),
      template: '%s · FreshCarts',
    },
    description: t('meta.siteDescription'),
    applicationName: 'FreshCarts',
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#00450D',
  width: 'device-width',
  initialScale: 1,
  // Zoom stays enabled: disabling it fails WCAG and hurts the shoppers we care most about.
  maximumScale: 5,
};

/**
 * `lang` and `dir` are written here, from the language cookie, so the very first
 * paint of an Urdu reader's page is already right-to-left and in Urdu. Reading
 * the cookie makes every route render per request rather than from a static
 * file — the price of not flashing English at someone who chose Urdu.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getT();

  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={inter.variable + ' ' + notoNastaliqUrdu.variable}
    >
      <body className="min-h-dvh bg-background text-text antialiased">
        {/* Lets keyboard users jump past the navigation on every page. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
        >
          {t('common.skipToContent')}
        </a>

        <AppProviders initialLocale={locale}>{children}</AppProviders>
      </body>
    </html>
  );
}

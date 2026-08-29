import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Nastaliq_Urdu } from 'next/font/google';
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

export const metadata: Metadata = {
  title: {
    default: 'FreshCarts — Fresh groceries, delivered',
    template: '%s · FreshCarts',
  },
  description:
    'Order fresh groceries from stores near you. Delivery or pickup, with honest prices.',
  applicationName: 'FreshCarts',
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#00450D',
  width: 'device-width',
  initialScale: 1,
  // Zoom stays enabled: disabling it fails WCAG and hurts the shoppers we care most about.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable + ' ' + notoNastaliqUrdu.variable}>
      <body className="min-h-dvh bg-background text-text antialiased">
        {/* Lets keyboard users jump past the navigation on every page. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
        >
          Skip to content
        </a>

        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

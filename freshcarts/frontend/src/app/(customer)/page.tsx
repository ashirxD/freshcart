import { HomeScreen } from './home-screen';

/**
 * Server component: it owns the route's metadata and renders the interactive
 * screen, which is the only part that needs to run in the browser.
 */
export const metadata = {
  title: 'FreshCarts — Fresh groceries, delivered',
};

export default function Page() {
  return <HomeScreen />;
}

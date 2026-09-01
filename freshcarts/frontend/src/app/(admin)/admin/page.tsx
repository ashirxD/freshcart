import { AdminDashboardScreen } from './dashboard-screen';

export const metadata = { title: 'Dashboard' };

/** The back office opens on the control centre, which is what it is for. */
export default function Page() {
  return <AdminDashboardScreen />;
}

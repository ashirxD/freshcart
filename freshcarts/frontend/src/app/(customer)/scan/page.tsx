import { ScanScreen } from './scan-screen';

export const metadata = {
  title: 'Scan Grocery List',
  description: 'Take a photo of your grocery list and we will find the items for you.',
};

export default function Page() {
  return <ScanScreen />;
}

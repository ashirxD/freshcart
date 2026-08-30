import { redirect } from 'next/navigation';

/** The back office opens on the catalogue, which is what it is for. */
export default function Page() {
  redirect('/admin/products');
}

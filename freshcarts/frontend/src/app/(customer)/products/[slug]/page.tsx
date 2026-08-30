import type { Metadata } from 'next';
import { ProductScreen } from './product-screen';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const readable = slug.replace(/-/g, ' ');

  return { title: readable.charAt(0).toUpperCase() + readable.slice(1) };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  return <ProductScreen slug={slug} />;
}

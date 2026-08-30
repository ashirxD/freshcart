import type { Metadata } from 'next';
import { CategoryScreen } from './category-screen';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * The slug is the only readable thing available without a request, so the tab
 * title is derived from it. The screen itself fetches the real category.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const readable = slug.replace(/-/g, ' ');

  return { title: readable.charAt(0).toUpperCase() + readable.slice(1) };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  return <CategoryScreen slug={slug} />;
}

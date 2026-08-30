'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, PackageSearch } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SectionHeader } from '@/components/common/section-header';
import { Container } from '@/components/layout/container';
import { AddToCart } from '@/components/product/add-to-cart';
import { AvailabilityBadge, DiscountBadge } from '@/components/product/badges';
import { FavoriteButton } from '@/components/product/favorite-button';
import { PriceDisplay } from '@/components/product/price-display';
import { ProductImage } from '@/components/product/product-image';
import { ProductRail } from '@/components/product/product-grid';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useProduct, useRelatedProducts } from '@/features/catalog/catalog.hooks';
import { ApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import type { ProductDetail } from '@/types/catalog';

/**
 * The product page.
 *
 * Desktop is a genuine two-column layout — gallery beside the buying panel —
 * rather than the mobile stack stretched wide.
 */
export function ProductScreen({ slug }: { slug: string }) {
  const { data: product, isPending, isError, error, refetch } = useProduct(slug);
  const related = useRelatedProducts(slug);

  if (isPending) return <ProductScreenSkeleton />;

  if (isError) {
    const isMissing = error instanceof ApiError && error.status === 404;

    return (
      <Container className="py-lg">
        {isMissing ? (
          <EmptyState
            icon={<PackageSearch className="size-7" aria-hidden="true" />}
            title="Product not found"
            description="This product may have sold out permanently or been removed from the catalogue."
            action={
              <ButtonLink href="/categories" variant="primary">
                Browse the store
              </ButtonLink>
            }
            className="bg-surface-muted rounded-lg"
          />
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </Container>
    );
  }

  return (
    <div className="gap-lg py-gutter flex flex-col">
      <Container className="gap-lg flex flex-col lg:flex-row lg:items-start lg:gap-8">
        <div className="gap-gutter flex flex-col lg:w-1/2">
          <Breadcrumb product={product} />
          <Gallery product={product} />
        </div>

        <div className="gap-gutter flex flex-col lg:w-1/2 lg:pt-10">
          <header className="gap-gutter flex items-start justify-between">
            <div className="flex flex-col gap-1">
              {product.brand ? (
                <p className="text-text-muted text-sm font-medium">{product.brand}</p>
              ) : null}

              <h1 id="main-content" className="text-text text-2xl leading-tight font-bold">
                {product.name}
              </h1>

              <p className="text-text-muted text-sm">{product.unitLabel}</p>
            </div>

            <FavoriteButton productId={product.id} productName={product.name} />
          </header>

          <div className="gap-gutter flex flex-wrap items-center">
            <PriceDisplay
              sellingPrice={product.sellingPrice}
              compareAtPrice={product.compareAtPrice}
              size="lg"
            />
            <DiscountBadge discountPercent={product.discountPercent} />
          </div>

          <AvailabilityBadge stock={product.stock} className="text-sm" />

          <div className="sticky bottom-20 z-10 md:static">
            <AddToCart product={product} variant="full" />
          </div>

          {product.description ? (
            <section className="gap-xs border-outline-variant pt-gutter flex flex-col border-t">
              <h2 className="text-text text-base font-semibold">About this product</h2>
              <p className="text-text-muted text-sm leading-relaxed">{product.description}</p>
            </section>
          ) : null}

          <dl className="gap-x-gutter gap-y-xs border-outline-variant pt-gutter grid grid-cols-2 border-t text-sm">
            <Detail label="Pack size" value={product.unitLabel} />
            <Detail label="Item code" value={product.sku} />
            {product.category ? <Detail label="Category" value={product.category.name} /> : null}
            {product.subcategory ? <Detail label="Type" value={product.subcategory.name} /> : null}
          </dl>
        </div>
      </Container>

      {related.data && related.data.length > 0 ? (
        <Container className="gap-gutter flex flex-col">
          <SectionHeader
            title="Similar products"
            subtitle={
              product.subcategory
                ? 'More in ' + product.subcategory.name
                : 'More in ' + (product.category?.name ?? 'this category')
            }
          />
          <ProductRail products={related.data} />
        </Container>
      ) : null}
    </div>
  );
}

/**
 * Gallery with thumbnails. Falls back to the generated placeholder tile when
 * the product has no imagery, which is the normal state until object storage
 * is configured.
 */
function Gallery({ product }: { product: ProductDetail }) {
  const [selected, setSelected] = useState(0);
  const image = product.images[selected] ?? product.primaryImage;

  return (
    <div className="gap-gutter flex flex-col">
      <div className="bg-surface-muted relative aspect-square w-full overflow-hidden rounded-lg">
        <ProductImage
          image={image}
          name={product.name}
          priority
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="size-full"
        />
      </div>

      {product.images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto">
          {product.images.map((entry, index) => (
            <li key={entry.url}>
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-label={'Show image ' + (index + 1) + ' of ' + product.images.length}
                aria-current={index === selected}
                className={cn(
                  'relative size-16 overflow-hidden rounded-md border-2',
                  index === selected ? 'border-primary' : 'border-outline-variant',
                )}
              >
                <ProductImage
                  image={entry}
                  name={product.name}
                  sizes="64px"
                  className="size-full"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text font-medium">{value}</dd>
    </div>
  );
}

function Breadcrumb({ product }: { product: ProductDetail }) {
  if (!product.category) return null;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-text-muted flex flex-wrap items-center gap-1 text-sm">
        <li>
          <Link href="/categories" className="hover:text-primary">
            Categories
          </Link>
        </li>
        <li className="flex items-center gap-1">
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          <Link href={'/categories/' + product.category.slug} className="hover:text-primary">
            {product.category.name}
          </Link>
        </li>
        {product.subcategory ? (
          <li className="flex items-center gap-1">
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            <Link href={'/categories/' + product.subcategory.slug} className="hover:text-primary">
              {product.subcategory.name}
            </Link>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}

function ProductScreenSkeleton() {
  return (
    <Container className="gap-lg py-lg flex flex-col lg:flex-row lg:gap-8">
      <Skeleton className="aspect-square w-full rounded-lg lg:w-1/2" label="Loading product" />
      <div className="gap-gutter flex flex-col lg:w-1/2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-touch w-full rounded-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </Container>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, PackageSearch, Store, Truck } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SectionHeader } from '@/components/common/section-header';
import { Container } from '@/components/layout/container';
import { AddToCart } from '@/components/product/add-to-cart';
import { AvailabilityBadge, DiscountBadge } from '@/components/product/badges';
import { FavoriteButton } from '@/components/product/favorite-button';
import { PriceDisplay } from '@/components/product/price-display';
import { ProductImage } from '@/components/product/product-image';
import { ProductRail } from '@/components/product/product-rail';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useProduct, useRelatedProducts } from '@/features/catalog/catalog.hooks';
import { ApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { productTint } from '@/lib/format';
import { useReveal } from '@/lib/use-reveal';
import type { ProductDetail } from '@/types/catalog';

/**
 * THE PRODUCT PAGE
 *
 * One primary focus, and it is the product (§80): the photograph takes the left
 * half of a desktop screen, and everything needed to buy — price, availability,
 * add — sits in the first screenful beside it.
 *
 * The add control is deliberately NOT sticky on mobile. It used to be, pinned
 * above the tab bar; now that the basket bar rides there when the basket has
 * something in it, a sticky add button would either sit under it or fight it
 * for the same 60 pixels. The buying panel is directly under the image instead,
 * which on a phone means it is visible almost immediately anyway.
 */
export function ProductScreen({ slug }: { slug: string }) {
  const { data: product, isPending, isError, error, refetch } = useProduct(slug);
  const related = useRelatedProducts(slug);
  const relatedReveal = useReveal();

  if (isPending) return <ProductScreenSkeleton />;

  if (isError) {
    const isMissing = error instanceof ApiError && error.status === 404;

    return (
      <Container className="py-wide">
        {isMissing ? (
          <EmptyState
            icon={<PackageSearch aria-hidden="true" />}
            title="We could not find that product"
            description="It may have been renamed, or the shop may no longer stock it."
            action={
              <ButtonLink href="/categories" variant="primary">
                Browse the aisles
              </ButtonLink>
            }
            className="bg-surface-muted rounded-2xl"
          />
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </Container>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="bg-cream/60 py-loose md:py-wide">
        <Container className="gap-loose flex flex-col lg:flex-row lg:items-start lg:gap-10">
          <div className="gap-gutter flex flex-col lg:w-1/2">
            <Breadcrumb product={product} />
            <Gallery product={product} />
          </div>

          <div className="gap-gutter flex flex-col lg:w-1/2 lg:pt-9">
            <header className="gap-gutter flex items-start justify-between">
              <div className="flex flex-col gap-1.5">
                {product.brand ? (
                  <p className="text-eyebrow text-leaf uppercase">{product.brand}</p>
                ) : null}

                <h1 className="text-display text-text max-w-lg">{product.name}</h1>

                <p className="text-text-muted text-sm font-medium">{product.unitLabel}</p>
              </div>

              <FavoriteButton productId={product.id} productName={product.name} />
            </header>

            {/* The buying panel: the one card on this page with a surface of
                its own, so the eye goes to the price and the button. */}
            <div className="ring-outline-variant bg-surface p-gutter gap-gutter shadow-card flex flex-col rounded-2xl ring-1">
              <div className="gap-snug flex flex-wrap items-center">
                <PriceDisplay
                  sellingPrice={product.sellingPrice}
                  compareAtPrice={product.compareAtPrice}
                  size="lg"
                />
                <DiscountBadge discountPercent={product.discountPercent} />
              </div>

              <AvailabilityBadge stock={product.stock} className="text-xs" />

              <AddToCart product={product} variant="full" />

              {/* What happens after the button, stated before it is pressed. */}
              <ul className="border-outline-variant gap-tight text-text-muted flex flex-col border-t pt-3 text-xs">
                <li className="flex items-center gap-2">
                  <Truck className="text-leaf size-4 shrink-0" aria-hidden="true" />
                  Delivery charge worked out from your address at checkout
                </li>
                <li className="flex items-center gap-2">
                  <Store className="text-leaf size-4 shrink-0" aria-hidden="true" />
                  Or collect from the shop at no extra charge
                </li>
              </ul>
            </div>

            {product.description ? (
              <section className="gap-tight flex flex-col">
                <h2 className="text-text text-base font-bold tracking-[-0.015em]">
                  About this product
                </h2>
                <p className="text-text-muted text-sm leading-relaxed">{product.description}</p>
              </section>
            ) : null}

            <dl className="border-outline-variant gap-x-gutter grid grid-cols-2 gap-y-3 border-t pt-4 text-sm">
              <Detail label="Pack size" value={product.unitLabel} />
              <Detail label="Item code" value={product.sku} />
              {product.category ? <Detail label="Aisle" value={product.category.name} /> : null}
              {product.subcategory ? (
                <Detail label="Type" value={product.subcategory.name} />
              ) : null}
            </dl>
          </div>
        </Container>
      </div>

      {related.data && related.data.length > 0 ? (
        <section
          ref={relatedReveal.ref}
          className={cn('py-wide md:py-section', relatedReveal.className)}
        >
          <Container className="gap-loose flex flex-col">
            <SectionHeader
              eyebrow="You might also need"
              title="Similar products"
              subtitle={
                product.subcategory
                  ? 'More in ' + product.subcategory.name
                  : 'More in ' + (product.category?.name ?? 'this aisle')
              }
            />
            <ProductRail products={related.data} label="Similar products" />
          </Container>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Gallery with thumbnails. Falls back to the generated placeholder tile when
 * the product has no imagery, which is the normal state until a shopkeeper
 * photographs the shelf.
 */
function Gallery({ product }: { product: ProductDetail }) {
  const [selected, setSelected] = useState(0);
  const image = product.images[selected] ?? product.primaryImage;

  return (
    <div className="gap-snug flex flex-col">
      <div
        className={cn(
          'ring-outline-variant/70 relative aspect-square w-full overflow-hidden rounded-2xl ring-1',
          productTint(product.name),
        )}
      >
        <ProductImage
          image={image}
          name={product.name}
          priority
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="size-full p-6"
        />
      </div>

      {product.images.length > 1 ? (
        <ul className="gap-tight flex overflow-x-auto pb-1">
          {product.images.map((entry, index) => (
            <li key={entry.url}>
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-label={'Show image ' + (index + 1) + ' of ' + product.images.length}
                aria-current={index === selected}
                className={cn(
                  'relative size-16 overflow-hidden rounded-lg ring-2 transition-[box-shadow]',
                  productTint(product.name),
                  index === selected ? 'ring-primary' : 'ring-outline-variant hover:ring-outline',
                )}
              >
                <ProductImage
                  image={entry}
                  name={product.name}
                  sizes="64px"
                  className="size-full p-1"
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
    <div className="flex flex-col gap-0.5">
      <dt className="text-text-muted text-xs font-semibold tracking-[0.03em] uppercase">{label}</dt>
      <dd className="text-text font-semibold">{value}</dd>
    </div>
  );
}

function Breadcrumb({ product }: { product: ProductDetail }) {
  if (!product.category) return null;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-text-muted flex flex-wrap items-center gap-1 text-sm">
        <li>
          <Link href="/categories" className="hover:text-primary transition-colors">
            Aisles
          </Link>
        </li>
        <li className="flex items-center gap-1">
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          <Link
            href={'/categories/' + product.category.slug}
            className="hover:text-primary transition-colors"
          >
            {product.category.name}
          </Link>
        </li>
        {product.subcategory ? (
          <li className="flex items-center gap-1">
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            <Link
              href={'/categories/' + product.subcategory.slug}
              className="hover:text-primary transition-colors"
            >
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
    <div className="bg-cream/60 py-loose md:py-wide">
      <Container className="gap-loose flex flex-col lg:flex-row lg:gap-10">
        <Skeleton className="aspect-square w-full rounded-2xl lg:w-1/2" label="Loading product" />
        <div className="gap-gutter flex flex-col lg:w-1/2 lg:pt-9">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Container>
    </div>
  );
}

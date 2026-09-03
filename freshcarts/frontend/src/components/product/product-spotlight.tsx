import Link from 'next/link';
import { cn } from '@/lib/cn';
import { productTint } from '@/lib/format';
import type { Product } from '@/types/catalog';
import { AddToCart } from './add-to-cart';
import { AvailabilityBadge, DiscountBadge } from './badges';
import { FavoriteButton } from './favorite-button';
import { PriceDisplay } from './price-display';
import { ProductImage } from './product-image';
import { ProductRow } from './product-row';

export interface ProductSpotlightProps {
  products: Product[];
  className?: string;
}

/**
 * One product given the room of four, with the rest of the shelf beside it.
 *
 * SECTION VARIETY (§29)
 * A storefront where every band is the same grid has no rhythm, and the eye
 * stops reading it after the second one. This is the second shape in the
 * system: a single large tile paired with a compact list, which also happens to
 * be the honest way to present "featured" — something the store actually
 * singled out, shown as singled out.
 *
 * WHICH PRODUCT IS FEATURED
 * The first one the API returned. No client-side ranking, no invented
 * "bestseller" ordering — the store's own order, presented larger.
 */
export function ProductSpotlight({ products, className }: ProductSpotlightProps) {
  const [lead, ...rest] = products;
  if (!lead) return null;

  return (
    <div className={cn('gap-gutter grid lg:grid-cols-2 lg:gap-6', className)}>
      <FeatureTile product={lead} />

      {rest.length > 0 ? (
        <ul className="gap-tight flex flex-col">
          {rest.slice(0, 4).map((product) => (
            <li key={product.id} className="flex">
              <ProductRow product={product} className="w-full" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The large tile. A landscape composition on desktop rather than a stretched
 * product card: the image takes the left half and the buying panel the right,
 * so the extra space becomes information rather than empty padding.
 */
function FeatureTile({ product }: { product: Product }) {
  const isSoldOut = !product.stock.isAvailable;

  return (
    <article
      className={cn(
        'group ring-outline-variant/70 bg-surface shadow-card relative flex overflow-hidden',
        'flex-col rounded-2xl ring-1 sm:flex-row',
        'ease-standard hover:shadow-raised transition-shadow duration-200',
      )}
    >
      <div
        className={cn(
          'relative aspect-[4/3] w-full shrink-0 overflow-hidden sm:aspect-auto sm:w-1/2',
          productTint(product.name),
        )}
      >
        <Link
          href={'/products/' + product.slug}
          tabIndex={-1}
          aria-hidden="true"
          className="block size-full"
        >
          <ProductImage
            image={product.primaryImage}
            name={product.name}
            priority
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 100vw"
            className="ease-standard size-full p-4 transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <DiscountBadge discountPercent={product.discountPercent} />
          <FavoriteButton
            productId={product.id}
            productName={product.name}
            size="sm"
            className="ms-auto"
          />
        </div>

        {isSoldOut ? (
          <div className="bg-text/25 absolute inset-0 flex items-end p-3 backdrop-blur-[1px]">
            <span className="bg-surface text-text shadow-card rounded-full px-2.5 py-1 text-xs font-bold">
              Out of stock
            </span>
          </div>
        ) : null}
      </div>

      <div className="p-gutter gap-tight sm:p-loose flex flex-1 flex-col">
        {product.brand ? (
          <p className="text-text-muted text-[0.6875rem] font-bold tracking-[0.04em] uppercase">
            {product.brand}
          </p>
        ) : null}

        <h3 className="text-text text-lg leading-tight font-bold tracking-[-0.02em]">
          <Link href={'/products/' + product.slug} className="before:absolute before:inset-0">
            <span className="line-clamp-2">{product.name}</span>
          </Link>
        </h3>

        <p className="text-text-muted text-sm font-medium">{product.unitLabel}</p>

        {product.shortDescription ? (
          <p className="text-text-muted line-clamp-2 text-sm">{product.shortDescription}</p>
        ) : null}

        <div className="gap-tight mt-auto flex flex-col pt-2">
          <PriceDisplay
            sellingPrice={product.sellingPrice}
            compareAtPrice={product.compareAtPrice}
            size="lg"
          />
          <AvailabilityBadge stock={product.stock} className="text-xs" />

          <div className="relative z-10 pt-1">
            <AddToCart product={product} variant="full" />
          </div>
        </div>
      </div>
    </article>
  );
}

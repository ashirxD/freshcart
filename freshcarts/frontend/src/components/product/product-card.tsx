import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { Product } from '@/types/catalog';
import { AddToCart } from './add-to-cart';
import { AvailabilityBadge, DiscountBadge } from './badges';
import { FavoriteButton } from './favorite-button';
import { PriceDisplay } from './price-display';
import { ProductImage } from './product-image';

export interface ProductCardProps {
  product: Product;
  /** Set on the first few cards above the fold so the images are not lazy. */
  priority?: boolean;
  className?: string;
}

/**
 * The single product card used by every listing — home rails, category pages,
 * search results, favourites. There is deliberately no per-page variant: a
 * shopper should recognise the same card wherever they meet it.
 *
 * The whole card is not one big link. The favourite and add-to-cart controls
 * are separate interactive targets, and nesting them inside an anchor would
 * make the markup invalid and the card unusable with a keyboard.
 */
export function ProductCard({ product, priority, className }: ProductCardProps) {
  const isSoldOut = !product.stock.isAvailable;

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-lg',
        'border-outline-variant bg-surface shadow-card border',
        'focus-within:shadow-raised hover:shadow-raised transition-shadow',
        className,
      )}
    >
      <div className="bg-surface-muted relative aspect-square w-full overflow-hidden">
        <Link
          href={'/products/' + product.slug}
          // The image is a link to the product, but its accessible name comes
          // from the heading below — repeating it here would announce twice.
          tabIndex={-1}
          aria-hidden="true"
          className="block size-full"
        >
          <ProductImage
            image={product.primaryImage}
            name={product.name}
            priority={priority}
            sizes="(min-width: 1024px) 20vw, (min-width: 640px) 30vw, 45vw"
            className="size-full transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </Link>

        {/* Above the stretched link below, so the heart stays clickable. */}
        <div className="absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2">
          <DiscountBadge discountPercent={product.discountPercent} />
          <FavoriteButton
            productId={product.id}
            productName={product.name}
            size="sm"
            className="ms-auto"
          />
        </div>

        {isSoldOut ? (
          <div className="bg-text/35 absolute inset-0 flex items-end p-2">
            <span className="bg-surface text-text rounded-full px-2.5 py-1 text-xs font-semibold">
              Out of stock
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.brand ? (
          <p className="text-text-muted truncate text-xs font-medium">{product.brand}</p>
        ) : null}

        <h3 className="text-text text-sm leading-snug font-semibold">
          {/* Stretched link: the title is the card's accessible name, and the
              pseudo-element makes the whole tile clickable without wrapping
              the buttons in an anchor. */}
          <Link href={'/products/' + product.slug} className="before:absolute before:inset-0">
            <span className="line-clamp-2">{product.name}</span>
          </Link>
        </h3>

        <p className="text-text-muted text-xs">{product.unitLabel}</p>

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <PriceDisplay
            sellingPrice={product.sellingPrice}
            compareAtPrice={product.compareAtPrice}
          />
          <AvailabilityBadge stock={product.stock} />

          {/* Raised above the stretched link so it stays clickable. */}
          <div className="relative z-10">
            <AddToCart product={product} size="sm" className="w-full" />
          </div>
        </div>
      </div>
    </article>
  );
}

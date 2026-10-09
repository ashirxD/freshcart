import Link from 'next/link';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { productTint } from '@/lib/format';
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
 * The single product card used by every listing — storefront rails, category
 * pages, search results, favourites. There is deliberately no per-page variant:
 * a shopper should recognise the same card wherever they meet it.
 *
 * WHAT MAKES IT AN OBJECT RATHER THAN A BOX (§8, §23)
 * Three layers, not one outline: a warm wash behind the product, white under
 * the words, and a hairline ring plus a soft shadow around the whole thing. The
 * card lifts 4px on hover and the photograph pushes in slightly at the same
 * time, so the tile behaves like something sitting on a shelf.
 *
 * The whole card is not one big link. The favourite and add-to-cart controls
 * are separate interactive targets, and nesting them inside an anchor would
 * make the markup invalid and the card unusable with a keyboard.
 */
export function ProductCard({ product, priority, className }: ProductCardProps) {
  const t = useT();
  const isSoldOut = !product.stock.isAvailable;

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-xl',
        'bg-surface ring-outline-variant/70 shadow-card ring-1',
        'ease-standard transition-[transform,box-shadow] duration-200',
        'hover:shadow-raised focus-within:shadow-raised hover:-translate-y-1',
        className,
      )}
    >
      <div
        className={cn(
          'relative aspect-square w-full overflow-hidden',
          'border-outline-variant/60 border-b',
          productTint(product.name),
        )}
      >
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
            sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
            className={cn(
              'size-full p-2',
              'ease-standard transition-transform duration-300 group-hover:scale-[1.04]',
            )}
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
          <div className="bg-text/25 absolute inset-0 flex items-end p-2 backdrop-blur-[1px]">
            <span className="bg-surface text-text shadow-card rounded-full px-2.5 py-1 text-xs font-bold">
              {t('product.outOfStock')}
            </span>
          </div>
        ) : null}
      </div>

      <div className="p-snug flex flex-1 flex-col gap-0.5">
        {product.brand ? (
          <p className="text-text-muted truncate text-[0.6875rem] font-bold tracking-[0.04em] uppercase">
            {product.brand}
          </p>
        ) : null}

        <h3 className="text-card text-text">
          {/* Stretched link: the title is the card's accessible name, and the
              pseudo-element makes the whole tile clickable without wrapping
              the buttons in an anchor. */}
          <Link href={'/products/' + product.slug} className="before:absolute before:inset-0">
            <span className="line-clamp-2">{product.name}</span>
          </Link>
        </h3>

        <p className="text-text-muted text-xs font-medium">{product.unitLabel}</p>

        <div className="gap-tight mt-auto flex flex-col pt-2.5">
          <div className="flex items-end justify-between gap-2">
            <PriceDisplay
              sellingPrice={product.sellingPrice}
              compareAtPrice={product.compareAtPrice}
            />
            <AvailabilityBadge stock={product.stock} className="pb-0.5 text-end" />
          </div>

          {/*
            Raised above the stretched link so it stays clickable.

            Deliberately the full 48px control rather than the `sm` one: on a
            phone this is the primary action of the card and it has to be
            comfortably thumb-sized (§54). Only the horizontal padding is
            trimmed, so the label still fits a two-column mobile grid.
          */}
          <div className="relative z-10">
            <AddToCart product={product} className="px-snug w-full text-sm" />
          </div>
        </div>
      </div>
    </article>
  );
}

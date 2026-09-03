import Link from 'next/link';
import { cn } from '@/lib/cn';
import { productTint } from '@/lib/format';
import type { Product } from '@/types/catalog';
import { AddToCart } from './add-to-cart';
import { AvailabilityBadge } from './badges';
import { PriceDisplay } from './price-display';
import { ProductImage } from './product-image';

export interface ProductRowProps {
  product: Product;
  className?: string;
}

/**
 * A product as a single line rather than a card.
 *
 * This is what stops the storefront being four identical grids stacked on top
 * of each other (§29). It is also the denser, faster way to re-add a familiar
 * staple — a shopper who knows they want atta does not need a 200px photograph
 * of it — so it carries the same add control as the card, at the same size.
 */
export function ProductRow({ product, className }: ProductRowProps) {
  return (
    <article
      className={cn(
        'group gap-snug p-tight relative flex items-center rounded-xl',
        'ring-outline-variant/70 bg-surface ring-1',
        'ease-standard hover:shadow-card transition-[box-shadow,border-color] duration-200',
        className,
      )}
    >
      <div
        className={cn(
          'relative size-16 shrink-0 overflow-hidden rounded-lg',
          productTint(product.name),
        )}
      >
        <ProductImage
          image={product.primaryImage}
          name={product.name}
          sizes="64px"
          className="size-full p-1"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 className="text-text text-[0.875rem] leading-snug font-semibold">
          <Link href={'/products/' + product.slug} className="before:absolute before:inset-0">
            <span className="line-clamp-2">{product.name}</span>
          </Link>
        </h3>

        <p className="text-text-muted text-xs font-medium">{product.unitLabel}</p>

        <div className="flex flex-wrap items-baseline gap-x-2">
          <PriceDisplay
            sellingPrice={product.sellingPrice}
            compareAtPrice={product.compareAtPrice}
            size="sm"
          />
          <AvailabilityBadge stock={product.stock} />
        </div>
      </div>

      {/* Raised above the stretched link so it stays clickable. */}
      <div className="relative z-10 shrink-0">
        <AddToCart product={product} className="px-snug text-sm" />
      </div>
    </article>
  );
}

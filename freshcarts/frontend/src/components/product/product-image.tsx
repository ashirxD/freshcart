import Image from 'next/image';
import { cn } from '@/lib/cn';
import { initialsFor, placeholderTint } from '@/lib/format';

export interface ProductImageProps {
  image: { url: string; alt: string } | null;
  /** Used for the placeholder's initials and tint when there is no image. */
  name: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}

/**
 * One place that decides how a product looks when it has no photograph.
 *
 * Rather than a broken icon or a grey box, a product without imagery gets a
 * tinted tile carrying its initials — deterministic per product, so the same
 * item looks the same on every screen. Seed data ships without images because
 * no object storage is configured yet; this is what makes that state presentable
 * instead of embarrassing.
 *
 * Remote images are rendered `unoptimized`: the optimizer refuses hosts that are
 * not in `next.config.mjs` `images.remotePatterns`, and an admin may paste a URL
 * from anywhere. Add the real bucket host there to switch optimisation on.
 */
export function ProductImage({ image, name, sizes, className, priority }: ProductImageProps) {
  if (!image) {
    return (
      <div
        className={cn('flex items-center justify-center', placeholderTint(name), className)}
        // Decorative: the product name is always adjacent in the DOM, so
        // announcing initials here would only add noise.
        aria-hidden="true"
      >
        <span className="text-primary/50 text-2xl font-semibold tracking-tight">
          {initialsFor(name)}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={image.url}
      alt={image.alt}
      fill
      unoptimized
      sizes={sizes}
      priority={priority}
      className={cn('object-cover', className)}
    />
  );
}

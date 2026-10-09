'use client';

import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { useFavoriteIds, useToggleFavorite } from '@/features/favorites/favorites.hooks';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/store/toast.store';

export interface FavoriteButtonProps {
  productId: string;
  /** Used to build the accessible label — "Add Olper's Milk to favourites". */
  productName: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The heart control, usable straight from a product card.
 *
 * An icon-only button with no text is invisible to a screen reader, so the
 * label names the actual product and states which way the toggle goes.
 * Signed-out shoppers are sent to sign in rather than silently failing.
 */
export function FavoriteButton({
  productId,
  productName,
  size = 'md',
  className,
}: FavoriteButtonProps) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const favoriteIds = useFavoriteIds();
  const toggle = useToggleFavorite();

  const status = useAuthStore((state) => state.status);
  const isFavorite = favoriteIds.has(productId);

  const label = isFavorite
    ? t('product.removeFromFavourites', { name: productName })
    : t('product.addToFavourites', { name: productName });

  const handleClick = () => {
    if (status !== 'authenticated') {
      toast({ title: t('product.signInToSave'), variant: 'info' });
      router.push('/login?next=' + encodeURIComponent(window.location.pathname));
      return;
    }

    toggle.mutate({ productId, isFavorite });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      aria-pressed={isFavorite}
      className={cn(
        // THE TARGET, which is bigger than the disc.
        //
        // On a product card the heart reads best as a 36px disc, but 36px is
        // an uncomfortable thumb target and there are twenty of them on a
        // phone screen (§54). So the BUTTON is 44px and transparent, and the
        // disc inside it is the thing you see. The visual weight is unchanged;
        // the tappable area is a third larger.
        'group/fav flex shrink-0 items-center justify-center rounded-full',
        'ease-standard transition-transform duration-150 active:scale-90',
        size === 'sm' ? 'size-11' : 'size-12',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex items-center justify-center rounded-full',
          'bg-surface/90 shadow-card backdrop-blur-[2px]',
          'ease-standard transition-colors duration-150',
          'group-hover/fav:bg-surface group-hover/fav:text-tomato',
          isFavorite ? 'text-tomato' : 'text-outline',
          size === 'sm' ? 'size-9' : 'size-11',
        )}
      >
        {/*
          The heart is keyed on its state, so switching it on remounts the glyph
          and `animate-heart` plays: one 1.32× beat and back, ~380ms (§39). It is
          deliberately not a bounce or a burst of particles — this control gets
          pressed dozens of times on a shopping run.
        */}
        <Heart
          key={String(isFavorite)}
          className={cn(
            size === 'sm' ? 'size-4' : 'size-5',
            isFavorite && 'animate-heart fill-current',
          )}
        />
      </span>
    </button>
  );
}

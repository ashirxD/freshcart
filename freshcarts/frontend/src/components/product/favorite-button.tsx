'use client';

import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { useFavoriteIds, useToggleFavorite } from '@/features/favorites/favorites.hooks';
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
  const router = useRouter();
  const toast = useToast();
  const favoriteIds = useFavoriteIds();
  const toggle = useToggleFavorite();

  const status = useAuthStore((state) => state.status);
  const isFavorite = favoriteIds.has(productId);

  const label = isFavorite
    ? 'Remove ' + productName + ' from favourites'
    : 'Add ' + productName + ' to favourites';

  const handleClick = () => {
    if (status !== 'authenticated') {
      toast({ title: 'Sign in to save your favourites', variant: 'info' });
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
        'flex shrink-0 items-center justify-center rounded-full',
        'bg-surface/90 text-outline shadow-card backdrop-blur-[2px]',
        'hover:text-danger transition-colors',
        isFavorite && 'text-danger',
        size === 'sm' ? 'size-9' : 'size-11',
        className,
      )}
    >
      <Heart
        className={cn(size === 'sm' ? 'size-4' : 'size-5', isFavorite && 'fill-current')}
        aria-hidden="true"
      />
    </button>
  );
}

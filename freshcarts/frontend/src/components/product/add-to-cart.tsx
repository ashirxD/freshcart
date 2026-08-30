'use client';

import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { QuantitySelector } from '@/components/common/quantity-selector';
import { Button } from '@/components/ui/button';
import {
  useAddToCart,
  useCart,
  useRemoveCartItem,
  useUpdateCartItem,
} from '@/features/cart/cart.hooks';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/store/toast.store';
import type { Product } from '@/types/catalog';

export interface AddToCartProps {
  product: Product;
  size?: 'sm' | 'md';
  /** Full-width button with a label, for the product page. */
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * Add-to-cart that becomes a quantity stepper once the product is in the cart.
 *
 * Keeping both states in one control means a shopper adjusts the quantity where
 * they added it, without a trip to the cart — the single biggest saving in taps
 * on a grocery run.
 *
 * The stock ceiling shown here is a convenience so "+" disables at the right
 * point; the server re-checks availability on every mutation regardless.
 */
export function AddToCart({
  product,
  size = 'md',
  variant = 'compact',
  className,
}: AddToCartProps) {
  const router = useRouter();
  const toast = useToast();

  const status = useAuthStore((state) => state.status);
  const { data: cart } = useCart();

  const addToCart = useAddToCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();

  const line = cart?.items.find((item) => item.productId === product.id);
  const isPending = addToCart.isPending || updateItem.isPending || removeItem.isPending;
  const isSoldOut = !product.stock.isAvailable;

  const requireSignIn = (): boolean => {
    if (status === 'authenticated') return false;

    toast({ title: 'Sign in to start shopping', variant: 'info' });
    router.push('/login?next=' + encodeURIComponent(window.location.pathname));
    return true;
  };

  if (isSoldOut) {
    return (
      <Button
        variant="outline"
        size={size === 'sm' ? 'sm' : 'md'}
        disabled
        fullWidth={variant === 'full'}
        className={className}
      >
        Out of stock
      </Button>
    );
  }

  if (line) {
    return (
      <QuantitySelector
        value={line.quantity}
        max={line.maxQuantity}
        size={size}
        removable
        disabled={isPending}
        label={'quantity of ' + product.name}
        itemName={product.name}
        className={cn(variant === 'full' && 'w-full justify-between', className)}
        onChange={(quantity) => {
          if (quantity <= 0) {
            removeItem.mutate(product.id);
            return;
          }
          updateItem.mutate({ productId: product.id, quantity });
        }}
      />
    );
  }

  return (
    <Button
      variant="primary"
      size={size === 'sm' ? 'sm' : 'md'}
      isLoading={isPending}
      fullWidth={variant === 'full'}
      leadingIcon={
        variant === 'compact' ? <Plus className="size-4" aria-hidden="true" /> : undefined
      }
      // Named for the product: a screen of identical "Add" buttons is unusable
      // when the labels are read out of context.
      aria-label={'Add ' + product.name + ' to cart'}
      className={className}
      onClick={() => {
        if (requireSignIn()) return;
        addToCart.mutate({ productId: product.id, quantity: 1 });
      }}
    >
      {variant === 'full' ? 'Add to cart' : 'Add'}
    </Button>
  );
}

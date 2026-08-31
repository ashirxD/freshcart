import {
  Ban,
  CheckCircle2,
  ChefHat,
  Clock,
  PackageCheck,
  Store,
  Truck,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { OrderStatus, PaymentStatus } from '@/types/order';

/**
 * Status appearance.
 *
 * Every entry pairs a colour with an ICON and a WORD. Colour alone would fail
 * anyone with a colour-vision deficiency and anyone in a high-contrast mode —
 * §39 and §56 both require the label, and the label is what actually carries
 * the meaning here.
 *
 * The palette is the design system's functional set (success / danger / the
 * secondary container for "in progress"), never an invented colour.
 */
interface StatusStyle {
  icon: LucideIcon;
  tone: string;
}

const STATUS_STYLE: Record<OrderStatus, StatusStyle> = {
  PENDING: { icon: Clock, tone: 'bg-surface-sunken text-text-muted' },
  CONFIRMED: { icon: CheckCircle2, tone: 'bg-primary/10 text-primary' },
  PREPARING: { icon: ChefHat, tone: 'bg-secondary-container/40 text-secondary' },
  PACKED: { icon: PackageCheck, tone: 'bg-secondary-container/40 text-secondary' },
  OUT_FOR_DELIVERY: { icon: Truck, tone: 'bg-primary/10 text-primary' },
  READY_FOR_PICKUP: { icon: Store, tone: 'bg-primary/10 text-primary' },
  DELIVERED: { icon: CheckCircle2, tone: 'bg-success/10 text-success' },
  CANCELLED: { icon: Ban, tone: 'bg-surface-sunken text-text-muted' },
  REJECTED: { icon: XCircle, tone: 'bg-danger/10 text-danger' },
  FAILED: { icon: XCircle, tone: 'bg-danger/10 text-danger' },
};

export interface OrderStatusBadgeProps {
  status: OrderStatus;
  /** The server's wording — "Collected" for a pickup, "Delivered" for a delivery. */
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function OrderStatusBadge({ status, label, size = 'md', className }: OrderStatusBadgeProps) {
  const style = STATUS_STYLE[status];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        style.tone,
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden="true" />
      {label}
    </span>
  );
}

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PENDING: 'Payment due',
  PAID: 'Paid',
  FAILED: 'Not collected',
  REFUNDED: 'Refunded',
};

const PAYMENT_TONE: Record<PaymentStatus, string> = {
  PENDING: 'bg-secondary-container/40 text-secondary',
  PAID: 'bg-success/10 text-success',
  FAILED: 'bg-surface-sunken text-text-muted',
  REFUNDED: 'bg-surface-sunken text-text-muted',
};

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        PAYMENT_TONE[status],
        className,
      )}
    >
      {PAYMENT_LABEL[status]}
    </span>
  );
}

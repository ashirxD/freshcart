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
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { useI18n } from '@/i18n';
import { orderStatusLabel, paymentStatusLabel } from '@/lib/order-copy';
import type { FulfillmentMethod, OrderStatus, PaymentStatus } from '@/types/order';

/**
 * THE SEMANTIC STATUS SYSTEM (§73, §74)
 *
 * One mapping, used by the shopper's order history, the store console and the
 * admin back office — so a PACKED order is the same colour and the same word in
 * all three, and a manager and a customer never describe the same order
 * differently.
 *
 * The progression is deliberate rather than decorative: amber while the order
 * is waiting on somebody, berry while it is being worked on, teal while it is
 * moving, leaf-green when it is done, and a restrained red only for the two
 * outcomes that actually failed. Cancelled is neutral, not red — a shopper
 * changing their mind is not an error.
 *
 * Every entry pairs a colour with an ICON and a WORD. Colour alone would fail
 * anyone with a colour-vision deficiency and anyone in a high-contrast mode,
 * and the label is what carries the meaning here.
 */
const STATUS_STYLE: Record<OrderStatus, { icon: LucideIcon; tone: BadgeTone }> = {
  PENDING: { icon: Clock, tone: 'attention' },
  CONFIRMED: { icon: CheckCircle2, tone: 'brand' },
  PREPARING: { icon: ChefHat, tone: 'berry' },
  PACKED: { icon: PackageCheck, tone: 'fresh' },
  OUT_FOR_DELIVERY: { icon: Truck, tone: 'info' },
  READY_FOR_PICKUP: { icon: Store, tone: 'info' },
  DELIVERED: { icon: CheckCircle2, tone: 'fresh' },
  CANCELLED: { icon: Ban, tone: 'neutral' },
  REJECTED: { icon: XCircle, tone: 'danger' },
  FAILED: { icon: XCircle, tone: 'danger' },
};

export interface OrderStatusBadgeProps {
  status: OrderStatus;
  /**
   * The server's wording — "Collected" for a pickup, "Delivered" for a delivery.
   * Shown as-is in English; other languages are built from `status` instead.
   */
  label: string;
  /** Lets a finished pickup read "collected" rather than "delivered". */
  fulfillmentMethod?: FulfillmentMethod;
  size?: 'sm' | 'md';
  className?: string;
}

export function OrderStatusBadge({
  status,
  label,
  fulfillmentMethod,
  size = 'md',
  className,
}: OrderStatusBadgeProps) {
  const { t, locale } = useI18n();
  const style = STATUS_STYLE[status];
  const Icon = style.icon;

  return (
    <Badge
      tone={style.tone}
      size={size}
      className={className}
      icon={<Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden="true" />}
    >
      {orderStatusLabel(status, fulfillmentMethod, label, t, locale)}
    </Badge>
  );
}

const PAYMENT_STYLE: Record<PaymentStatus, { tone: BadgeTone }> = {
  PENDING: { tone: 'attention' },
  PAID: { tone: 'fresh' },
  FAILED: { tone: 'neutral' },
  REFUNDED: { tone: 'neutral' },
};

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  const { t } = useI18n();
  const style = PAYMENT_STYLE[status];
  return (
    <Badge tone={style.tone} className={className}>
      {paymentStatusLabel(status, t)}
    </Badge>
  );
}

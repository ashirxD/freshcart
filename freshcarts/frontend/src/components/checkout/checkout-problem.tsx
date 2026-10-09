'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, MapPinOff, Store, TrendingDown, TrendingUp, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Money } from '@/components/common/ltr';
import { useI18n } from '@/i18n';
import { describeError, describeIssue } from '@/lib/api/error-copy';
import { ApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { formatPkr } from '@/lib/format';
import { formatDistance } from './order-summary-panel';
import type { CheckoutIssueDetails, DeliveryUnavailableDetails } from '@/types/order';

export interface CheckoutProblemProps {
  error: unknown;
  /** Wired to the "accept the new prices" mutation. */
  onAcceptPrices?: () => void;
  isAcceptingPrices?: boolean;
  onRetry?: () => void;
  className?: string;
}

/**
 * The one place a checkout failure is rendered.
 *
 * It branches on the API's `code`, never on message text, and it shows the
 * server's own message — that message names the product or the distance
 * involved, which nothing on the client could reconstruct.
 *
 * Each branch ends with an action the shopper can actually take: accept the new
 * prices, go and fix the cart, switch to pickup, retry. §68's "no dead-end
 * screens" is the rule this component exists to satisfy.
 */
export function CheckoutProblem({
  error,
  onAcceptPrices,
  isAcceptingPrices = false,
  onRetry,
  className,
}: CheckoutProblemProps) {
  const { t, locale } = useI18n();
  const messageFor = () => describeError(error, t, locale);

  if (!(error instanceof ApiError)) {
    return (
      <ProblemShell
        className={className}
        icon={<AlertTriangle className="size-5" aria-hidden="true" />}
        title={t('checkout.problem.genericTitle')}
        message={t('checkout.problem.genericMessage')}
        action={onRetry ? <Button onClick={onRetry}>{t('common.tryAgain')}</Button> : undefined}
      />
    );
  }

  if (error.isNetworkError) {
    return (
      <ProblemShell
        className={className}
        icon={<WifiOff className="size-5" aria-hidden="true" />}
        title={t('checkout.problem.offlineTitle')}
        message={messageFor()}
        action={onRetry ? <Button onClick={onRetry}>{t('common.tryAgain')}</Button> : undefined}
      />
    );
  }

  switch (error.code) {
    case 'CHECKOUT_VALIDATION_FAILED': {
      const details = error.contextAs<CheckoutIssueDetails>();
      const issues = details?.issues ?? [];

      // Every problem is a price move: the shopper only has to look and agree.
      if (details?.requiresPriceAcceptance && onAcceptPrices) {
        return (
          <ProblemShell
            className={className}
            icon={<TrendingUp className="size-5" aria-hidden="true" />}
            title={t('checkout.problem.pricesTitle')}
            message={messageFor()}
            action={
              <div className="gap-tight flex flex-col sm:flex-row">
                <Button onClick={onAcceptPrices} isLoading={isAcceptingPrices}>
                  {t('checkout.problem.continueNewPrices')}
                </Button>
                <ButtonLink href="/cart" variant="outline">
                  {t('checkout.problem.reviewBasket')}
                </ButtonLink>
              </div>
            }
          >
            <ul className="gap-tight flex list-none flex-col">
              {issues.map((issue) => {
                const isCheaper =
                  issue.currentPrice !== undefined &&
                  issue.previousPrice !== undefined &&
                  issue.currentPrice < issue.previousPrice;

                return (
                  <li
                    key={issue.productId}
                    className="gap-gutter bg-surface px-gutter flex items-center justify-between rounded-md py-2 text-sm"
                  >
                    <span className="text-text min-w-0 truncate font-medium">
                      <bdi>{issue.productName}</bdi>
                    </span>

                    <span className="flex shrink-0 items-center gap-2 tabular-nums">
                      {issue.previousPrice !== undefined ? (
                        <span className="text-text-muted line-through">
                          <Money>{formatPkr(issue.previousPrice)}</Money>
                        </span>
                      ) : null}
                      {issue.currentPrice !== undefined ? (
                        <span
                          className={cn(
                            'flex items-center gap-1 font-semibold',
                            isCheaper ? 'text-success' : 'text-danger',
                          )}
                        >
                          {isCheaper ? (
                            <TrendingDown className="size-3.5" aria-hidden="true" />
                          ) : (
                            <TrendingUp className="size-3.5" aria-hidden="true" />
                          )}
                          <Money className={isCheaper ? 'text-success' : 'text-danger'}>
                            {formatPkr(issue.currentPrice)}
                          </Money>
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </ProblemShell>
        );
      }

      // Stock or availability: the cart itself has to change.
      return (
        <ProblemShell
          className={className}
          icon={<AlertTriangle className="size-5" aria-hidden="true" />}
          title={t('checkout.problem.basketNeeds')}
          message={messageFor()}
          action={<ButtonLink href="/cart">{t('checkout.problem.goToBasket')}</ButtonLink>}
        >
          {issues.length > 1 ? (
            <ul className="text-text flex list-none flex-col gap-1 text-sm">
              {issues.map((issue) => (
                <li key={issue.productId}>• {describeIssue(issue, t, locale, formatPkr)}</li>
              ))}
            </ul>
          ) : null}
        </ProblemShell>
      );
    }

    case 'DELIVERY_UNAVAILABLE': {
      const details = error.contextAs<DeliveryUnavailableDetails>();

      return (
        <ProblemShell
          className={className}
          icon={<MapPinOff className="size-5" aria-hidden="true" />}
          title={t('checkout.problem.cannotDeliver')}
          message={messageFor()}
        >
          {details ? (
            <p className="text-text-muted text-sm">
              {t('checkout.problem.distanceNote', {
                distance: formatDistance(details.distanceMeters, t),
                max: formatDistance(details.maxDistanceMeters, t),
              })}
            </p>
          ) : null}
        </ProblemShell>
      );
    }

    case 'ADDRESS_COORDINATES_REQUIRED':
      return (
        <ProblemShell
          className={className}
          icon={<MapPinOff className="size-5" aria-hidden="true" />}
          title={t('checkout.problem.needsMapTitle')}
          message={messageFor()}
          action={
            <ButtonLink href="/addresses" variant="outline">
              {t('checkout.problem.manageAddresses')}
            </ButtonLink>
          }
        />
      );

    case 'STORE_UNAVAILABLE':
      return (
        <ProblemShell
          className={className}
          icon={<Store className="size-5" aria-hidden="true" />}
          title={t('checkout.problem.storeClosedTitle')}
          message={messageFor()}
          action={
            <ButtonLink href="/" variant="outline">
              {t('checkout.problem.keepBrowsing')}
            </ButtonLink>
          }
        />
      );

    case 'CART_EMPTY':
      return (
        <ProblemShell
          className={className}
          icon={<AlertTriangle className="size-5" aria-hidden="true" />}
          title={t('checkout.problem.basketEmpty')}
          message={messageFor()}
          action={<ButtonLink href="/categories">{t('cart.startShopping')}</ButtonLink>}
        />
      );

    case 'DUPLICATE_REQUEST':
      return (
        <ProblemShell
          className={className}
          icon={<AlertTriangle className="size-5" aria-hidden="true" />}
          title={t('checkout.problem.duplicateTitle')}
          message={messageFor()}
          action={
            <ButtonLink href="/orders" variant="outline">
              {t('checkout.problem.checkOrders')}
            </ButtonLink>
          }
        />
      );

    case 'ROUTING_UNAVAILABLE':
    case 'DELIVERY_PRICING_UNAVAILABLE':
      return (
        <ProblemShell
          className={className}
          icon={<MapPinOff className="size-5" aria-hidden="true" />}
          title={t('checkout.problem.cannotWork')}
          message={messageFor()}
          action={onRetry ? <Button onClick={onRetry}>{t('common.tryAgain')}</Button> : undefined}
        />
      );

    default:
      return (
        <ProblemShell
          className={className}
          icon={<AlertTriangle className="size-5" aria-hidden="true" />}
          title={t('checkout.problem.cannotContinue')}
          message={
            // A 5xx message is written for an engineer, not a shopper.
            error.status >= 500 ? t('checkout.problem.serverFault') : messageFor()
          }
          action={onRetry ? <Button onClick={onRetry}>{t('common.tryAgain')}</Button> : undefined}
        />
      );
  }
}

function ProblemShell({
  icon,
  title,
  message,
  action,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      // `alert` so the failure is announced the moment it appears — a shopper
      // using a screen reader must not have to go hunting for what changed.
      role="alert"
      className={cn(
        'gap-gutter ring-danger/25 bg-danger/5 p-gutter flex flex-col rounded-2xl ring-1',
        className,
      )}
    >
      <div className="gap-snug flex items-start">
        <span className="bg-surface text-danger flex size-10 shrink-0 items-center justify-center rounded-xl">
          {icon}
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="text-text text-base font-bold tracking-[-0.015em]">{title}</h3>
          <p className="text-text-muted text-sm">{message}</p>
        </div>
      </div>

      {children}
      {action}
    </div>
  );
}

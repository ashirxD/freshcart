'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, MapPinOff, Store, TrendingDown, TrendingUp, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
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
  if (!(error instanceof ApiError)) {
    return (
      <ProblemShell
        className={className}
        icon={<AlertTriangle className="size-5" aria-hidden="true" />}
        title="Something went wrong"
        message="Please try again in a moment."
        action={onRetry ? <Button onClick={onRetry}>Try again</Button> : undefined}
      />
    );
  }

  if (error.isNetworkError) {
    return (
      <ProblemShell
        className={className}
        icon={<WifiOff className="size-5" aria-hidden="true" />}
        title="You appear to be offline"
        message={error.message}
        action={onRetry ? <Button onClick={onRetry}>Try again</Button> : undefined}
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
            title="Some prices changed"
            message={error.message}
            action={
              <div className="flex flex-col gap-xs sm:flex-row">
                <Button onClick={onAcceptPrices} isLoading={isAcceptingPrices}>
                  Continue at the new prices
                </Button>
                <ButtonLink href="/cart" variant="outline">
                  Review my cart
                </ButtonLink>
              </div>
            }
          >
            <ul className="flex list-none flex-col gap-xs">
              {issues.map((issue) => {
                const isCheaper =
                  issue.currentPrice !== undefined &&
                  issue.previousPrice !== undefined &&
                  issue.currentPrice < issue.previousPrice;

                return (
                  <li
                    key={issue.productId}
                    className="flex items-center justify-between gap-gutter rounded-md bg-surface px-gutter py-2 text-sm"
                  >
                    <span className="min-w-0 truncate font-medium text-text">
                      {issue.productName}
                    </span>

                    <span className="flex shrink-0 items-center gap-2 tabular-nums">
                      {issue.previousPrice !== undefined ? (
                        <span className="text-text-muted line-through">
                          {formatPkr(issue.previousPrice)}
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
                          {formatPkr(issue.currentPrice)}
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
          title="Your cart needs a change"
          message={error.message}
          action={
            <ButtonLink href="/cart">Go to my cart</ButtonLink>
          }
        >
          {issues.length > 1 ? (
            <ul className="flex list-none flex-col gap-1 text-sm text-text">
              {issues.map((issue) => (
                <li key={issue.productId}>• {issue.message}</li>
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
          title="We cannot deliver there"
          message={error.message}
        >
          {details ? (
            <p className="text-sm text-text-muted">
              That address is {formatDistance(details.distanceMeters)} from the store. We deliver up
              to {formatDistance(details.maxDistanceMeters)}.
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
          title="This address needs a map location"
          message={error.message}
          action={
            <ButtonLink href="/addresses" variant="outline">
              Manage my addresses
            </ButtonLink>
          }
        />
      );

    case 'STORE_UNAVAILABLE':
      return (
        <ProblemShell
          className={className}
          icon={<Store className="size-5" aria-hidden="true" />}
          title="The store is not taking orders"
          message={error.message}
          action={
            <ButtonLink href="/" variant="outline">
              Keep browsing
            </ButtonLink>
          }
        />
      );

    case 'CART_EMPTY':
      return (
        <ProblemShell
          className={className}
          icon={<AlertTriangle className="size-5" aria-hidden="true" />}
          title="Your cart is empty"
          message={error.message}
          action={
            <ButtonLink href="/categories">Start shopping</ButtonLink>
          }
        />
      );

    case 'DUPLICATE_REQUEST':
      return (
        <ProblemShell
          className={className}
          icon={<AlertTriangle className="size-5" aria-hidden="true" />}
          title="This order is already being placed"
          message={error.message}
          action={
            <ButtonLink href="/orders" variant="outline">
              Check my orders
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
          title="We cannot work out delivery right now"
          message={error.message}
          action={onRetry ? <Button onClick={onRetry}>Try again</Button> : undefined}
        />
      );

    default:
      return (
        <ProblemShell
          className={className}
          icon={<AlertTriangle className="size-5" aria-hidden="true" />}
          title="We could not continue"
          message={
            // A 5xx message is written for an engineer, not a shopper.
            error.status >= 500
              ? 'Something went wrong at our end. Nothing has been charged — please try again.'
              : error.message
          }
          action={onRetry ? <Button onClick={onRetry}>Try again</Button> : undefined}
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
        'flex flex-col gap-gutter rounded-lg border border-danger/30 bg-surface-muted p-gutter',
        className,
      )}
    >
      <div className="flex items-start gap-xs">
        <span className="mt-0.5 shrink-0 text-danger">{icon}</span>
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-text">{title}</h3>
          <p className="text-sm text-text-muted">{message}</p>
        </div>
      </div>

      {children}
      {action}
    </div>
  );
}

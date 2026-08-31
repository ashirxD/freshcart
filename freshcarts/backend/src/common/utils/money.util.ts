/**
 * MONEY
 *
 * Every amount in FreshCarts is a whole Pakistani rupee held in a JavaScript
 * `number` used strictly as an integer. Grocery pricing here does not use
 * paisa — shelf prices are Rs. 340, not Rs. 340.75 — so the rupee *is* the
 * smallest unit the domain needs, and an integer represents it exactly.
 *
 * That is the whole reason these helpers exist: they make the integer rule
 * explicit and enforceable instead of a convention people remember. Nothing in
 * the pricing path may divide, use a float literal, or call `toFixed` — a
 * subtotal is a sum of integers, and a total is a sum of integers.
 *
 * If sub-rupee pricing is ever needed, the migration is a single scale change
 * to paisa here plus the schema minimums — not a hunt for float drift.
 */

/** Rupees can be added safely up to this magnitude without precision loss. */
export const MAX_MONEY_PKR = 1_000_000_000;

export class MoneyError extends Error {}

/**
 * Guards a value that is about to enter a monetary calculation.
 *
 * Throws rather than rounding: a non-integer amount reaching this point means a
 * pricing rule produced something the domain cannot represent, and silently
 * rounding it would put a wrong number on a real receipt.
 */
export function assertMoney(amount: number, label: string): number {
  if (!Number.isInteger(amount)) {
    throw new MoneyError(label + ' must be a whole number of rupees, received ' + amount);
  }
  if (amount < 0) {
    throw new MoneyError(label + ' cannot be negative, received ' + amount);
  }
  if (amount > MAX_MONEY_PKR) {
    throw new MoneyError(label + ' exceeds the maximum supported amount');
  }
  return amount;
}

/** unitPrice × quantity, validated on the way in and on the way out. */
export function lineTotal(unitPrice: number, quantity: number): number {
  assertMoney(unitPrice, 'unitPrice');

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new MoneyError('quantity must be a positive whole number, received ' + quantity);
  }

  return assertMoney(unitPrice * quantity, 'lineTotal');
}

/** Exact sum of integer amounts. */
export function sumMoney(amounts: number[]): number {
  return assertMoney(
    amounts.reduce((total, amount) => total + assertMoney(amount, 'amount'), 0),
    'sum',
  );
}

/**
 * The single definition of an order total.
 *
 * Written once and called from both the preview and the order-creation path, so
 * the figure a shopper reviews is produced by the same code that persists.
 */
export function orderTotal(parts: {
  subtotal: number;
  deliveryFee: number;
  discount?: number;
}): number {
  const subtotal = assertMoney(parts.subtotal, 'subtotal');
  const deliveryFee = assertMoney(parts.deliveryFee, 'deliveryFee');
  const discount = assertMoney(parts.discount ?? 0, 'discount');

  if (discount > subtotal + deliveryFee) {
    throw new MoneyError('discount cannot exceed the amount being discounted');
  }

  return assertMoney(subtotal + deliveryFee - discount, 'total');
}

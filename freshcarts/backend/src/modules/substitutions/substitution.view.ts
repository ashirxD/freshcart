import { Types } from 'mongoose';
import { Substitution, SubstitutionReason, SubstitutionStatus } from './schemas';

/**
 * The substitution as both audiences see it.
 *
 * One shape for the store and the shopper, because there is nothing here either
 * side should be shielded from: it is a description of a swap, its prices and
 * who asked for it. `createdByUserId` stays server-side — the role is the useful
 * fact, a staff member's user id is not.
 */
export interface SubstitutionView {
  id: string;
  orderId: string;
  status: SubstitutionStatus;
  reason: SubstitutionReason;
  note: string | null;

  original: {
    productId: string;
    productName: string;
    unitLabel: string;
    quantity: number;
    /** Per unit, as agreed at checkout. */
    unitPrice: number;
    lineTotal: number;
  };

  replacement: {
    productId: string;
    productName: string;
    unitLabel: string;
    quantity: number;
    /** The replacement's catalogue price, shown for transparency. */
    catalogueUnitPrice: number;
    catalogueLineTotal: number;
  };

  /**
   * What the shopper will actually be charged if they accept — always the
   * original line total. Stated explicitly rather than left to be inferred,
   * because "will this cost me more?" is the only question that matters here.
   */
  chargedLineTotal: number;
  /** Rupees the store absorbs by supplying a dearer replacement. Never negative. */
  storeAbsorbs: number;

  createdByRole: string;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedByRole: string | null;
}

export type LeanSubstitution = Substitution & { _id: Types.ObjectId };

export function toSubstitutionView(substitution: LeanSubstitution): SubstitutionView {
  const chargedLineTotal = substitution.chargedUnitPrice * substitution.originalQuantity;
  const catalogueLineTotal = substitution.replacementUnitPrice * substitution.replacementQuantity;

  return {
    id: substitution._id.toString(),
    orderId: substitution.orderId.toString(),
    status: substitution.status,
    reason: substitution.reason,
    note: substitution.note,

    original: {
      productId: substitution.originalProductId.toString(),
      productName: substitution.originalProductName,
      unitLabel: substitution.originalUnitLabel,
      quantity: substitution.originalQuantity,
      unitPrice: substitution.chargedUnitPrice,
      lineTotal: chargedLineTotal,
    },

    replacement: {
      productId: substitution.replacementProductId.toString(),
      productName: substitution.replacementProductName,
      unitLabel: substitution.replacementUnitLabel,
      quantity: substitution.replacementQuantity,
      catalogueUnitPrice: substitution.replacementUnitPrice,
      catalogueLineTotal,
    },

    chargedLineTotal,
    storeAbsorbs: Math.max(0, catalogueLineTotal - chargedLineTotal),

    createdByRole: substitution.createdByRole,
    createdAt: substitution.createdAt,
    resolvedAt: substitution.resolvedAt,
    resolvedByRole: substitution.resolvedByRole,
  };
}

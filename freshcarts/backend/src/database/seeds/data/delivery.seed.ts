/**
 * Development delivery pricing.
 *
 * Bands are half-open — `[minDistanceMeters, maxDistanceMeters)` — so adjacent
 * bands meet exactly: a delivery measured at exactly 2,000 m is priced by the
 * 2-5 km band, with no gap and no overlap. See DeliveryPricingRule for why that
 * boundary convention is the only unambiguous one.
 *
 * These are example figures, not a commercial pricing policy. They live in the
 * database rather than in code precisely so that the real ones can be set
 * without a deploy, and the seeder writes them only when a store has none.
 *
 * The furthest band ends at 12,000 m, matching the default
 * DELIVERY_MAX_DISTANCE_METERS. If that limit is raised without adding a band,
 * `validateRuleSet` reports the gap and the pricing engine refuses to invent a
 * fee for the uncovered range.
 */
export interface SeedPricingRule {
  label: string;
  minDistanceMeters: number;
  maxDistanceMeters: number;
  fee: number;
  priority: number;
}

export function buildSeedDeliveryPricingRules(): SeedPricingRule[] {
  return [
    {
      label: 'Nearby (up to 2 km)',
      minDistanceMeters: 0,
      maxDistanceMeters: 2_000,
      fee: 80,
      priority: 0,
    },
    {
      label: 'Short (2-5 km)',
      minDistanceMeters: 2_000,
      maxDistanceMeters: 5_000,
      fee: 120,
      priority: 0,
    },
    {
      label: 'Medium (5-8 km)',
      minDistanceMeters: 5_000,
      maxDistanceMeters: 8_000,
      fee: 180,
      priority: 0,
    },
    {
      label: 'Long (8-12 km)',
      minDistanceMeters: 8_000,
      maxDistanceMeters: 12_000,
      fee: 250,
      priority: 0,
    },
  ];
}

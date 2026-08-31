import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { assertMoney } from 'src/common/utils';
import { BusinessException } from 'src/common/errors';
import { DeliveryPricingRule, DeliveryPricingRuleDocument } from './schemas';

/** A rule as the engine evaluates it — the persisted document or a plain object. */
export interface PricingBand {
  id: string;
  label: string;
  minDistanceMeters: number;
  maxDistanceMeters: number;
  fee: number;
  priority: number;
}

export interface PricedDelivery {
  fee: number;
  ruleId: string;
  ruleLabel: string;
}

/** More bands than any real pricing policy needs. See `activeBands`. */
const MAX_ACTIVE_PRICING_RULES = 50;

/** What is wrong with a rule set, reported by {@link validateRuleSet}. */
export interface RuleSetProblem {
  kind: 'OVERLAP' | 'GAP' | 'EMPTY';
  message: string;
}

/**
 * THE DELIVERY PRICING ENGINE
 *
 * Input: a distance in metres. Output: a fee in whole rupees, and which rule
 * produced it. That is the entire contract.
 *
 * It is a service of its own rather than a branch inside OrderService for two
 * reasons that matter beyond tidiness. First, pricing is the part most likely
 * to change — promotions, per-area rates, free delivery over a basket size —
 * and it changes in one file. Second, it is the part that must be provably
 * correct at its boundaries, which is only testable if it can be called without
 * a cart, an address or an order.
 *
 * There are no `if (distance < 2000)` statements anywhere else in the codebase.
 */
@Injectable()
export class DeliveryPricingService {
  private readonly logger = new Logger(DeliveryPricingService.name);

  constructor(
    @InjectModel(DeliveryPricingRule.name)
    private readonly ruleModel: Model<DeliveryPricingRuleDocument>,
  ) {}

  /**
   * Prices a distance against the store's configured bands.
   *
   * Fails loudly when no band matches. A default fee would be an invented
   * charge on a real receipt, and a fee of zero would show the shopper "free
   * delivery" that nobody decided to offer — §26 calls both out, and both are
   * worse than an honest "we cannot price this right now".
   */
  async priceFor(storeId: Types.ObjectId, distanceMeters: number): Promise<PricedDelivery> {
    if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
      throw BusinessException.deliveryPricingUnavailable();
    }

    const bands = await this.activeBands(storeId);

    if (bands.length === 0) {
      this.logger.error('No active delivery pricing rules configured for store ' + storeId);
      throw BusinessException.deliveryPricingUnavailable();
    }

    const match = DeliveryPricingService.selectBand(bands, distanceMeters);

    if (!match) {
      // Within the service area but outside every band: the configuration has a
      // gap. Refuse rather than guess.
      this.logger.error(
        'No delivery pricing rule covers ' + Math.round(distanceMeters) + ' m for store ' + storeId,
      );
      throw BusinessException.deliveryPricingUnavailable();
    }

    return {
      fee: assertMoney(match.fee, 'deliveryFee'),
      ruleId: match.id,
      ruleLabel: match.label,
    };
  }

  /**
   * Band selection. Pure, so every boundary case is testable directly.
   *
   * Bands are half-open `[min, max)`. Candidates are ordered by priority
   * (descending) then by lower bound (ascending), and the first match wins — so
   * even a misconfigured overlapping set prices deterministically.
   */
  static selectBand(bands: PricingBand[], distanceMeters: number): PricingBand | null {
    const ordered = [...bands].sort(
      (a, b) => b.priority - a.priority || a.minDistanceMeters - b.minDistanceMeters,
    );

    return (
      ordered.find(
        (band) =>
          distanceMeters >= band.minDistanceMeters && distanceMeters < band.maxDistanceMeters,
      ) ?? null
    );
  }

  /**
   * Reports overlaps and gaps in a rule set.
   *
   * Used by the seeder today and by the admin pricing screen when it lands. It
   * returns problems rather than throwing because the caller decides what to do
   * with them: the seeder logs, an admin form would show them beside the fields.
   */
  static validateRuleSet(bands: PricingBand[], maxServiceDistanceMeters: number): RuleSetProblem[] {
    if (bands.length === 0) {
      return [{ kind: 'EMPTY', message: 'No active delivery pricing rules are configured' }];
    }

    const problems: RuleSetProblem[] = [];
    const sorted = [...bands].sort((a, b) => a.minDistanceMeters - b.minDistanceMeters);

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];

      if (current.minDistanceMeters < previous.maxDistanceMeters) {
        problems.push({
          kind: 'OVERLAP',
          message: '"' + previous.label + '" and "' + current.label + '" cover the same distances',
        });
      } else if (current.minDistanceMeters > previous.maxDistanceMeters) {
        problems.push({
          kind: 'GAP',
          message:
            'No rule covers ' + previous.maxDistanceMeters + '-' + current.minDistanceMeters + ' m',
        });
      }
    }

    if (sorted[0].minDistanceMeters > 0) {
      problems.push({
        kind: 'GAP',
        message: 'No rule covers 0-' + sorted[0].minDistanceMeters + ' m',
      });
    }

    const furthest = Math.max(...sorted.map((band) => band.maxDistanceMeters));

    if (furthest < maxServiceDistanceMeters) {
      problems.push({
        kind: 'GAP',
        message:
          'Delivery is offered to ' +
          maxServiceDistanceMeters +
          ' m but pricing only reaches ' +
          furthest +
          ' m',
      });
    }

    return problems;
  }

  /** The bands an admin screen would list, and what the seeder validates. */
  async activeBands(storeId: Types.ObjectId): Promise<PricingBand[]> {
    const rules = await this.ruleModel
      .find({ storeId, isActive: true })
      .sort({ priority: -1, minDistanceMeters: 1 })
      // A store prices its deliveries with a handful of bands. The cap is not
      // expected to bind; it is here so a misconfigured or malicious rule set
      // can never make every checkout load an unbounded collection.
      .limit(MAX_ACTIVE_PRICING_RULES)
      .lean()
      .exec();

    return rules.map((rule) => ({
      id: rule._id.toString(),
      label: rule.label,
      minDistanceMeters: rule.minDistanceMeters,
      maxDistanceMeters: rule.maxDistanceMeters,
      fee: rule.fee,
      priority: rule.priority,
    }));
  }
}

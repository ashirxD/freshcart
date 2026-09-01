import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
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

/** A band plus whether it is switched on. What the admin screen lists. */
export interface DeliveryRuleView extends PricingBand {
  isActive: boolean;
}

/** What an admin form submits. */
export interface DeliveryRuleInput {
  label: string;
  minDistanceMeters: number;
  maxDistanceMeters: number;
  fee: number;
  priority: number;
  isActive: boolean;
}

/** The persisted fields both view mappers read. */
type LeanPricingRule = Pick<
  DeliveryPricingRule,
  'label' | 'minDistanceMeters' | 'maxDistanceMeters' | 'fee' | 'priority' | 'isActive'
> & { _id: Types.ObjectId };

export interface PricedDelivery {
  fee: number;
  ruleId: string;
  ruleLabel: string;
}

/** More bands than any real pricing policy needs. See `activeBands`. */
const MAX_ACTIVE_PRICING_RULES = 50;

/**
 * The admin listing includes deactivated rules, so its cap is higher than the
 * pricing path's — but it is still a cap, because an unbounded `find()` on a
 * collection an admin can add to is exactly the pattern section 39 forbids.
 */
const MAX_CONFIGURED_PRICING_RULES = 200;

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

  // --- Configuration (admin) ----------------------------------------------
  //
  // These four methods manage the rule *set*. They do not price anything —
  // `priceFor` above remains the only thing that turns a distance into a fee,
  // and it is unaffected by what an admin does here beyond reading the rows
  // that result. Section 17: the engine stays authoritative, the admin surface
  // only edits its configuration.

  /**
   * Every rule for a store, active or not, with the problems the set has.
   *
   * The problems come back beside the rules rather than as a separate call,
   * because a gap between two bands is a property of the set and an admin
   * cannot act on the list without seeing them together.
   */
  async listRules(
    storeId: Types.ObjectId,
    maxServiceDistanceMeters: number,
  ): Promise<{
    rules: DeliveryRuleView[];
    problems: RuleSetProblem[];
  }> {
    const rules = await this.ruleModel
      .find({ storeId })
      .sort({ minDistanceMeters: 1, priority: -1 })
      .limit(MAX_CONFIGURED_PRICING_RULES)
      .lean()
      .exec();

    const active = rules
      .filter((rule) => rule.isActive)
      .map((rule) => DeliveryPricingService.toBand(rule));

    return {
      rules: rules.map((rule) => DeliveryPricingService.toRuleView(rule)),
      problems: DeliveryPricingService.validateRuleSet(active, maxServiceDistanceMeters),
    };
  }

  async createRule(storeId: Types.ObjectId, input: DeliveryRuleInput): Promise<DeliveryRuleView> {
    await this.assertNoActiveOverlap(storeId, input, null);

    const created = await this.ruleModel.create({ ...input, storeId });
    this.logger.log('Delivery pricing rule created: ' + created.label);

    return DeliveryPricingService.toRuleView(created.toObject());
  }

  /**
   * Edits one rule.
   *
   * The store id is in the filter, not compared afterwards — the same rule the
   * rest of the codebase follows, so an admin acting on the wrong store gets a
   * 404 rather than a silent cross-store write.
   */
  async updateRule(
    storeId: Types.ObjectId,
    ruleId: string,
    input: Partial<DeliveryRuleInput>,
  ): Promise<DeliveryRuleView> {
    const existing = await this.loadRuleOrFail(storeId, ruleId);

    const merged: DeliveryRuleInput = {
      label: input.label ?? existing.label,
      minDistanceMeters: input.minDistanceMeters ?? existing.minDistanceMeters,
      maxDistanceMeters: input.maxDistanceMeters ?? existing.maxDistanceMeters,
      fee: input.fee ?? existing.fee,
      priority: input.priority ?? existing.priority,
      isActive: input.isActive ?? existing.isActive,
    };

    if (merged.isActive) {
      await this.assertNoActiveOverlap(storeId, merged, existing._id);
    }

    Object.assign(existing, merged);
    const saved = await existing.save();

    return DeliveryPricingService.toRuleView(saved.toObject());
  }

  /**
   * Removes a rule.
   *
   * Safe to delete outright, unlike a product: an order snapshots the fee it
   * was charged and only keeps `pricingRuleId` as a breadcrumb, so deleting the
   * rule cannot change a historical total. The last *active* rule is refused
   * anyway — a store with no bands cannot price a delivery at all, and finding
   * that out at a shopper's checkout is not acceptable.
   */
  async deleteRule(
    storeId: Types.ObjectId,
    ruleId: string,
  ): Promise<{ deleted: true; id: string }> {
    const existing = await this.loadRuleOrFail(storeId, ruleId);

    if (existing.isActive) {
      const remaining = await this.ruleModel.countDocuments({
        storeId,
        isActive: true,
        _id: { $ne: existing._id },
      });

      if (remaining === 0) {
        throw new ConflictException(
          'This is the only active pricing rule. Add a replacement before deleting it, or deliveries cannot be priced.',
        );
      }
    }

    await this.ruleModel.deleteOne({ _id: existing._id, storeId }).exec();
    this.logger.log('Delivery pricing rule deleted: ' + existing.label);

    return { deleted: true, id: ruleId };
  }

  /**
   * Refuses a rule that would overlap an existing active band.
   *
   * `validateRuleSet` reports overlaps for a set that already exists; this
   * stops one being created. Both are needed: the report explains a set seeded
   * or migrated into a bad state, this prevents an admin walking into one.
   */
  private async assertNoActiveOverlap(
    storeId: Types.ObjectId,
    candidate: Pick<DeliveryRuleInput, 'minDistanceMeters' | 'maxDistanceMeters' | 'isActive'>,
    excludeId: Types.ObjectId | null,
  ): Promise<void> {
    if (candidate.isActive === false) return;

    if (candidate.maxDistanceMeters <= candidate.minDistanceMeters) {
      throw new BadRequestException(
        'The upper distance must be greater than the lower distance, otherwise the band covers nothing.',
      );
    }

    const filter: FilterQuery<DeliveryPricingRuleDocument> = {
      storeId,
      isActive: true,
      // Half-open bands overlap when each starts before the other ends.
      minDistanceMeters: { $lt: candidate.maxDistanceMeters },
      maxDistanceMeters: { $gt: candidate.minDistanceMeters },
    };

    if (excludeId) filter._id = { $ne: excludeId };

    const clash = await this.ruleModel.findOne(filter).select('label').lean().exec();

    if (clash) {
      throw new ConflictException(
        'That distance range overlaps the active rule "' + clash.label + '".',
      );
    }
  }

  private async loadRuleOrFail(
    storeId: Types.ObjectId,
    ruleId: string,
  ): Promise<DeliveryPricingRuleDocument> {
    if (!Types.ObjectId.isValid(ruleId)) throw new NotFoundException('Pricing rule not found');

    const rule = await this.ruleModel.findOne({ _id: new Types.ObjectId(ruleId), storeId }).exec();

    if (!rule) throw new NotFoundException('Pricing rule not found');

    return rule;
  }

  private static toBand(rule: LeanPricingRule): PricingBand {
    return {
      id: rule._id.toString(),
      label: rule.label,
      minDistanceMeters: rule.minDistanceMeters,
      maxDistanceMeters: rule.maxDistanceMeters,
      fee: rule.fee,
      priority: rule.priority,
    };
  }

  private static toRuleView(rule: LeanPricingRule): DeliveryRuleView {
    return { ...DeliveryPricingService.toBand(rule), isActive: rule.isActive };
  }
}

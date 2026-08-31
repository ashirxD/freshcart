import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { BusinessException } from 'src/common/errors';
import {
  IDEMPOTENCY_KEY_MODEL,
  IdempotencyKeyDocument,
  IdempotencyState,
} from './idempotency-key.schema';

/** What a claim attempt found. */
export type ClaimOutcome =
  /** This request owns the operation and must perform it. */
  | { kind: 'CLAIMED' }
  /** An identical earlier request already finished; replay its result. */
  | { kind: 'REPLAY'; resultId: Types.ObjectId };

/**
 * IDEMPOTENCY
 * ===========
 *
 * The problem §33 describes is not hypothetical: on a phone, on a patchy
 * connection, the request that places an order is exactly the request most
 * likely to be retried — by the shopper double-tapping, by the browser after a
 * timeout, or by a refresh. Two orders, one basket, one shopper who is now
 * being charged twice.
 *
 * Disabling the button is not a solution. It stops one of those three causes,
 * on one device, and only while the page is alive.
 *
 * THE STRATEGY
 *
 *   1. The client generates a key (a UUID) once per checkout *attempt* and
 *      sends it in the `Idempotency-Key` header. It stays the same across
 *      retries of that attempt and changes when the shopper starts a new one.
 *   2. The server inserts a claim. The unique index on (userId, scope, key)
 *      makes exactly one insert win — that is the entire mutual exclusion, and
 *      it holds across processes and instances, unlike anything in memory.
 *   3. The winner does the work, then records the resulting order id.
 *   4. A retry that finds a COMPLETED claim is answered with the original order.
 *      A retry that finds one still IN_PROGRESS gets DUPLICATE_REQUEST, because
 *      the first attempt may yet succeed and guessing would risk a second order.
 *   5. If the work fails, the claim is released so the shopper can genuinely
 *      retry rather than being locked out by their own failed attempt.
 *
 * The key is required for order creation. Making it optional would mean the
 * protection is absent exactly when a client is careless — which is the case it
 * exists for.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectModel(IDEMPOTENCY_KEY_MODEL)
    private readonly keyModel: Model<IdempotencyKeyDocument>,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Attempts to claim `key` for `userId`.
   *
   * Returns CLAIMED to exactly one caller. Throws DUPLICATE_REQUEST when an
   * attempt is still running.
   */
  async claim(userId: string, scope: string, key: string): Promise<ClaimOutcome> {
    const ttlSeconds = this.configService.get('idempotency', { infer: true }).ttlSeconds;
    const owner = new Types.ObjectId(userId);

    try {
      await this.keyModel.create({
        userId: owner,
        scope,
        key,
        state: IdempotencyState.IN_PROGRESS,
        resultId: null,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      });

      return { kind: 'CLAIMED' };
    } catch (error) {
      if (!IdempotencyService.isDuplicateKey(error)) throw error;
    }

    // Someone else holds the claim. Whether this is a replay or a collision
    // with an in-flight attempt depends on how far that attempt got.
    const existing = await this.keyModel.findOne({ userId: owner, scope, key }).lean().exec();

    if (existing?.state === IdempotencyState.COMPLETED && existing.resultId) {
      this.logger.log('Idempotent replay for ' + scope + ' by user ' + userId);
      return { kind: 'REPLAY', resultId: existing.resultId };
    }

    // In progress, or completed without a result (which should not happen, but
    // returning "duplicate" is the safe reading either way).
    throw BusinessException.duplicateRequest();
  }

  /** Records the outcome so later retries of the same key replay it. */
  async complete(
    userId: string,
    scope: string,
    key: string,
    resultId: Types.ObjectId,
  ): Promise<void> {
    await this.keyModel
      .updateOne(
        { userId: new Types.ObjectId(userId), scope, key },
        { $set: { state: IdempotencyState.COMPLETED, resultId } },
      )
      .exec();
  }

  /**
   * Releases a claim whose work failed.
   *
   * Without this a shopper whose order failed for a fixable reason — a line went
   * out of stock — could not retry with the same key, and the client would have
   * to know to mint a new one. Deleting is correct precisely because nothing was
   * created: there is no result to protect.
   */
  async release(userId: string, scope: string, key: string): Promise<void> {
    await this.keyModel
      .deleteOne({
        userId: new Types.ObjectId(userId),
        scope,
        key,
        state: IdempotencyState.IN_PROGRESS,
      })
      .exec();
  }

  private static isDuplicateKey(error: unknown): boolean {
    return (error as { code?: number }).code === 11000;
  }
}

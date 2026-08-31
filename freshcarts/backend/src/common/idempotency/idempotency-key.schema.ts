import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type IdempotencyKeyDocument = HydratedDocument<IdempotencyKey>;

export const IDEMPOTENCY_KEY_COLLECTION = 'idempotency_keys';

/**
 * Registered under a string token rather than the class, so nothing outside
 * this folder needs to import the schema to inject the model.
 */
export const IDEMPOTENCY_KEY_MODEL = 'IdempotencyKey';

export enum IdempotencyState {
  /** Claimed by a request that is still running. */
  IN_PROGRESS = 'IN_PROGRESS',
  /** Finished successfully; `result` holds what to replay. */
  COMPLETED = 'COMPLETED',
}

/**
 * A claim on one client-initiated operation.
 *
 * The interesting field is the compound unique index at the bottom: inserting
 * `(userId, scope, key)` either succeeds — this request owns the operation — or
 * fails with a duplicate-key error, which means someone else already owns it.
 * That single insert is the whole concurrency control. No read-then-write, no
 * lock, no window in which two requests both believe they are first.
 *
 * Scoped by user as well as key so one shopper's key can never collide with,
 * or reveal, another's.
 */
@Schema({ timestamps: true, collection: IDEMPOTENCY_KEY_COLLECTION })
export class IdempotencyKey {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  /** Which operation this key is for, e.g. "order.create". */
  @Prop({ type: String, required: true, maxlength: 40 })
  scope: string;

  /** The client-generated key. Opaque to the server. */
  @Prop({ type: String, required: true, maxlength: 100 })
  key: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(IdempotencyState),
    default: IdempotencyState.IN_PROGRESS,
  })
  state: IdempotencyState;

  /**
   * The identifier the original call produced — an order id — so a retry can be
   * answered with the same order rather than a second one.
   *
   * Only an id is stored, never the full response: replaying a *fresh* read of
   * that order gives the retrying client current status and payment state,
   * where a frozen payload would hand back a stale one.
   */
  @Prop({ type: SchemaTypes.ObjectId, default: null })
  resultId: Types.ObjectId | null;

  /** When this claim stops being replayable. Enforced by the TTL index below. */
  @Prop({ type: Date, required: true })
  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const IdempotencyKeySchema = SchemaFactory.createForClass(IdempotencyKey);

/** The claim. Uniqueness here is the mechanism, not merely a constraint. */
IdempotencyKeySchema.index({ userId: 1, scope: 1, key: 1 }, { unique: true });

/**
 * MongoDB removes documents once `expiresAt` passes, so the collection cannot
 * grow without bound and a key becomes reusable after its window — which is the
 * correct behaviour for a key that is meant to guard one checkout attempt.
 */
IdempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

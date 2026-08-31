import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { ErrorCode } from 'src/common/errors';
import { IdempotencyKeyDocument } from './idempotency-key.schema';
import { IdempotencyService } from './idempotency.service';

const USER_ID = '64b000000000000000000009';
const SCOPE = 'order.create';
const KEY = 'checkout-attempt-0001';
const ORDER_ID = new Types.ObjectId('64b0000000000000000000f1');

/** The driver's duplicate-key error, which is how a lost claim announces itself. */
function duplicateKeyError() {
  return Object.assign(new Error('E11000 duplicate key error'), { code: 11000 });
}

describe('IdempotencyService', () => {
  type MockModel = Record<string, jest.Mock>;

  let keyModel: MockModel;
  let service: IdempotencyService;

  const configService = {
    get: () => ({ ttlSeconds: 86_400 }),
  } as unknown as ConfigService<AppConfig, true>;

  beforeEach(() => {
    keyModel = {
      create: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
      updateOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve(undefined) }),
      deleteOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve(undefined) }),
    };

    service = new IdempotencyService(
      keyModel as unknown as Model<IdempotencyKeyDocument>,
      configService,
    );
  });

  describe('claim', () => {
    it('grants the claim to the request that inserts first', async () => {
      await expect(service.claim(USER_ID, SCOPE, KEY)).resolves.toEqual({ kind: 'CLAIMED' });

      // The insert IS the mutual exclusion — one unique index, no lock, and it
      // holds across processes where anything in memory would not.
      expect(keyModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: new Types.ObjectId(USER_ID),
          scope: SCOPE,
          key: KEY,
          state: 'IN_PROGRESS',
        }),
      );
    });

    it('scopes the claim to the shopper, so two shoppers may use the same key', async () => {
      await service.claim(USER_ID, SCOPE, KEY);

      const written = keyModel.create.mock.calls[0][0] as { userId: Types.ObjectId };
      expect(written.userId).toEqual(new Types.ObjectId(USER_ID));
    });

    it('replays the original order when the same key already completed', async () => {
      keyModel.create.mockRejectedValue(duplicateKeyError());
      keyModel.findOne.mockReturnValue({
        lean: () => ({
          exec: () => Promise.resolve({ state: 'COMPLETED', resultId: ORDER_ID }),
        }),
      });

      // The double-tap, the refresh, the retry after a timeout: all get the
      // order that already exists rather than a second one.
      await expect(service.claim(USER_ID, SCOPE, KEY)).resolves.toEqual({
        kind: 'REPLAY',
        resultId: ORDER_ID,
      });
    });

    it('refuses while an earlier attempt is still running', async () => {
      keyModel.create.mockRejectedValue(duplicateKeyError());
      keyModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ state: 'IN_PROGRESS', resultId: null }) }),
      });

      // Guessing here would risk a second order, so the honest answer is
      // "already in flight, wait".
      await expect(service.claim(USER_ID, SCOPE, KEY)).rejects.toMatchObject({
        code: ErrorCode.DUPLICATE_REQUEST,
      });
    });

    it('refuses a completed claim that somehow has no result', async () => {
      keyModel.create.mockRejectedValue(duplicateKeyError());
      keyModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ state: 'COMPLETED', resultId: null }) }),
      });

      await expect(service.claim(USER_ID, SCOPE, KEY)).rejects.toMatchObject({
        code: ErrorCode.DUPLICATE_REQUEST,
      });
    });

    it('does not swallow a genuine database failure as a duplicate', async () => {
      keyModel.create.mockRejectedValue(new Error('connection lost'));

      await expect(service.claim(USER_ID, SCOPE, KEY)).rejects.toThrow('connection lost');
      expect(keyModel.findOne).not.toHaveBeenCalled();
    });

    it('sets an expiry so the collection cannot grow without bound', async () => {
      const before = Date.now();
      await service.claim(USER_ID, SCOPE, KEY);

      const written = keyModel.create.mock.calls[0][0] as { expiresAt: Date };
      expect(written.expiresAt.getTime()).toBeGreaterThan(before);
    });
  });

  describe('complete', () => {
    it('records the order so later retries replay it', async () => {
      await service.complete(USER_ID, SCOPE, KEY, ORDER_ID);

      expect(keyModel.updateOne).toHaveBeenCalledWith(
        { userId: new Types.ObjectId(USER_ID), scope: SCOPE, key: KEY },
        { $set: { state: 'COMPLETED', resultId: ORDER_ID } },
      );
    });
  });

  describe('release', () => {
    it('frees a failed attempt so the shopper can genuinely retry', async () => {
      await service.release(USER_ID, SCOPE, KEY);

      // Without this, a shopper whose order failed for a fixable reason would
      // be locked out by their own unsuccessful request.
      expect(keyModel.deleteOne).toHaveBeenCalledWith({
        userId: new Types.ObjectId(USER_ID),
        scope: SCOPE,
        key: KEY,
        state: 'IN_PROGRESS',
      });
    });

    it('cannot release a claim that already produced an order', async () => {
      await service.release(USER_ID, SCOPE, KEY);

      // The `state: IN_PROGRESS` term is what protects a completed claim from
      // being deleted and the order from being placed twice.
      const filter = keyModel.deleteOne.mock.calls[0][0] as { state: string };
      expect(filter.state).toBe('IN_PROGRESS');
    });
  });
});

import { ClientSession, Connection } from 'mongoose';
import { TransactionRunner } from './transaction.runner';

/**
 * Builds a runner over a fake connection.
 *
 * `supportsTransactions` drives the probe: a deployment that rejects a command
 * inside a transaction (a standalone `mongod`) versus one that accepts it (a
 * replica set). Both are real deployments FreshCarts runs on, so both paths are
 * tested rather than only the convenient one.
 */
function buildRunner(supportsTransactions: boolean) {
  const session = {
    startTransaction: jest.fn(),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn().mockResolvedValue(undefined),
    withTransaction: jest.fn(async (work: () => Promise<unknown>) => work()),
  } as unknown as ClientSession & Record<string, jest.Mock>;

  const connection = {
    startSession: jest.fn().mockResolvedValue(session),
    db: {
      collection: () => ({
        findOne: supportsTransactions
          ? jest.fn().mockResolvedValue(null)
          : jest
              .fn()
              .mockRejectedValue(
                new Error('Transaction numbers are only allowed on a replica set member or mongos'),
              ),
      }),
    },
  } as unknown as Connection;

  return { runner: new TransactionRunner(connection), session, connection };
}

describe('TransactionRunner', () => {
  describe('capability probing', () => {
    it('detects a deployment that supports transactions', async () => {
      const { runner } = buildRunner(true);
      await expect(runner.supportsTransactions()).resolves.toBe(true);
    });

    it('detects a standalone deployment by issuing a real command, not by trusting startTransaction', async () => {
      // startTransaction() is client-side only and always "succeeds". A probe
      // that stopped there would report support everywhere and every order
      // would then fail at the first inventory write.
      const { runner } = buildRunner(false);
      await expect(runner.supportsTransactions()).resolves.toBe(false);
    });

    it('probes once and remembers the answer', async () => {
      const { runner, connection } = buildRunner(true);

      await runner.supportsTransactions();
      await runner.supportsTransactions();
      await runner.run(async () => undefined);

      expect(connection.startSession).toHaveBeenCalledTimes(2); // one probe, one run
    });
  });

  describe('with transactions available', () => {
    it('runs the work inside a session and reports itself atomic', async () => {
      const { runner, session } = buildRunner(true);

      const result = await runner.run(async (context) => {
        expect(context.session).toBe(session);
        expect(context.isAtomic).toBe(true);
        return 'done';
      });

      expect(result).toBe('done');
      expect(session.withTransaction).toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalled();
    });

    it('ignores compensations — the abort is the rollback', async () => {
      const { runner } = buildRunner(true);
      const undo = jest.fn();

      await expect(
        runner.run(async (context) => {
          context.compensate('undo something', undo);
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      expect(undo).not.toHaveBeenCalled();
    });
  });

  describe('without transactions (compensating rollback)', () => {
    it('runs the work with no session and reports itself non-atomic', async () => {
      const { runner } = buildRunner(false);

      const result = await runner.run(async (context) => {
        expect(context.session).toBeNull();
        expect(context.isAtomic).toBe(false);
        return 42;
      });

      expect(result).toBe(42);
    });

    it('leaves compensations alone when the work succeeds', async () => {
      const { runner } = buildRunner(false);
      const undo = jest.fn();

      await runner.run(async (context) => {
        context.compensate('return stock', undo);
        return 'ok';
      });

      expect(undo).not.toHaveBeenCalled();
    });

    it('replays compensations in reverse when the work fails', async () => {
      const { runner } = buildRunner(false);
      const order: string[] = [];

      await expect(
        runner.run(async (context) => {
          context.compensate('return milk', async () => void order.push('milk'));
          context.compensate('return eggs', async () => void order.push('eggs'));
          context.compensate('delete order', async () => void order.push('order'));
          throw new Error('payment failed');
        }),
      ).rejects.toThrow('payment failed');

      // Newest first: the order document goes before the stock it was written
      // against is returned, which is the only order that cannot strand state.
      expect(order).toEqual(['order', 'eggs', 'milk']);
    });

    it('keeps rolling back when one compensation fails', async () => {
      const { runner } = buildRunner(false);
      const survivor = jest.fn();

      await expect(
        runner.run(async (context) => {
          context.compensate('return stock', survivor);
          context.compensate('delete order', async () => {
            throw new Error('delete failed');
          });
          throw new Error('original failure');
        }),
      ).rejects.toThrow('original failure');

      // One broken undo must not strand the rest — and the error the shopper
      // sees must still be the one that explains what went wrong.
      expect(survivor).toHaveBeenCalled();
    });

    it('propagates the original error, not a rollback error', async () => {
      const { runner } = buildRunner(false);

      await expect(
        runner.run(async (context) => {
          context.compensate('fail loudly', async () => {
            throw new Error('rollback exploded');
          });
          throw new Error('the real problem');
        }),
      ).rejects.toThrow('the real problem');
    });
  });
});

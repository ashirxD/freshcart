import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';

/**
 * A rollback step registered by the work unit.
 *
 * Only used on deployments without transaction support; with a real transaction
 * the abort undoes everything and these are never invoked.
 */
type Compensation = { describe: string; undo: () => Promise<unknown> };

/** Read-only target for the support probe. Never created, never written. */
const TRANSACTION_PROBE_COLLECTION = 'transaction_support_probe';

export interface TransactionContext {
  /**
   * Pass this to every write in the unit of work.
   *
   * `null` on a standalone MongoDB, where the driver rejects sessions with
   * transactions. Mongoose accepts `session: null` and simply ignores it, so
   * callers write `{ session }` unconditionally — there is no second code path.
   */
  readonly session: ClientSession | null;

  /** True when the writes are genuinely atomic. Useful for logging and tests. */
  readonly isAtomic: boolean;

  /**
   * Registers how to undo a write that has already been applied.
   *
   * Ignored when a transaction is active. Without one, these run in reverse
   * order if the unit of work throws — which is the difference between "we
   * decremented stock and then failed" and "nothing happened".
   */
  compensate(describe: string, undo: () => Promise<unknown>): void;
}

/**
 * TRANSACTION STRATEGY
 * ====================
 *
 * Order creation touches four collections — inventory, orders, payments and the
 * cart — and must not leave stock decremented with no order, or an order with
 * no stock deducted.
 *
 * MongoDB multi-document transactions solve this exactly, but they require a
 * replica set or a sharded cluster. FreshCarts development runs a standalone
 * `mongod`, and pretending otherwise would mean shipping code that silently
 * does nothing on the machine it is written on.
 *
 * So this runner supports both, honestly:
 *
 *   Replica set / Atlas (production)
 *     A real session and transaction. Every write joins it; a failure aborts
 *     and nothing is persisted. `isAtomic` is true.
 *
 *   Standalone mongod (development, CI)
 *     No session. Each write is individually atomic — crucially, the inventory
 *     decrement is a single guarded `$inc`, never read-then-write — and the
 *     unit of work registers a compensating undo for each one it applies. On
 *     failure the runner replays those undos in reverse. `isAtomic` is false.
 *
 * The fallback is a compensating-transaction saga, not a transaction. Its one
 * genuine weakness is a process crash between a write and its compensation,
 * which would leave stock decremented for an order that was never created —
 * over-counting stock, never overselling it. That is the safe direction to
 * fail, and it is why production must run a replica set.
 *
 * Support is probed once, lazily, against the live deployment rather than being
 * configured — a mismatched flag would be worse than no flag at all.
 */
@Injectable()
export class TransactionRunner {
  private readonly logger = new Logger(TransactionRunner.name);
  private transactionsSupported: boolean | null = null;

  constructor(@InjectConnection() private readonly connection: Connection) {}

  /**
   * Runs `work` atomically where the deployment allows it, and with
   * compensating rollback where it does not.
   */
  async run<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    return (await this.supportsTransactions())
      ? this.runInTransaction(work)
      : this.runWithCompensation(work);
  }

  /** Exposed so health checks and the final report can state what is in force. */
  async supportsTransactions(): Promise<boolean> {
    if (this.transactionsSupported !== null) return this.transactionsSupported;

    this.transactionsSupported = await this.probe();

    this.logger.log(
      this.transactionsSupported
        ? 'MongoDB transactions available — order creation is atomic'
        : 'MongoDB transactions unavailable (standalone deployment) — order creation uses compensating rollback',
    );

    return this.transactionsSupported;
  }

  /**
   * Asks the deployment, not the driver.
   *
   * `startTransaction()` alone proves nothing: it only sets client-side state
   * and always "succeeds". A standalone `mongod` does not object until the
   * first command carrying a transaction number actually reaches it. So the
   * probe issues a real read inside the transaction — cheap, against a
   * collection that need not exist — and treats any refusal as unsupported.
   *
   * Getting this wrong is not a cosmetic error: a false positive means every
   * order fails at the first inventory write, which is precisely the failure
   * this class exists to prevent.
   */
  private async probe(): Promise<boolean> {
    const database = this.connection.db;
    if (!database) return false;

    let session: ClientSession | null = null;

    try {
      session = await this.connection.startSession();
      session.startTransaction();

      // The command that actually carries a txnNumber to the server.
      await database.collection(TRANSACTION_PROBE_COLLECTION).findOne({}, { session });

      await session.abortTransaction();
      return true;
    } catch {
      return false;
    } finally {
      await session?.endSession().catch(() => undefined);
    }
  }

  private async runInTransaction<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();

    try {
      let result!: T;

      await session.withTransaction(async () => {
        result = await work({
          session,
          isAtomic: true,
          // A transaction abort is the rollback; registering one is a no-op.
          compensate: () => undefined,
        });
      });

      return result;
    } finally {
      await session.endSession();
    }
  }

  private async runWithCompensation<T>(
    work: (context: TransactionContext) => Promise<T>,
  ): Promise<T> {
    const compensations: Compensation[] = [];

    try {
      return await work({
        session: null,
        isAtomic: false,
        compensate: (describe, undo) => {
          compensations.push({ describe, undo });
        },
      });
    } catch (error) {
      await this.rollback(compensations);
      throw error;
    }
  }

  /**
   * Undoes applied writes newest-first.
   *
   * Each step is isolated: one failing undo must not prevent the rest from
   * running, and the original error — the one that explains the failure to the
   * shopper — must still be the one that propagates.
   */
  private async rollback(compensations: Compensation[]): Promise<void> {
    for (const compensation of [...compensations].reverse()) {
      try {
        await compensation.undo();
      } catch (error) {
        this.logger.error(
          'Compensation failed: ' + compensation.describe,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}

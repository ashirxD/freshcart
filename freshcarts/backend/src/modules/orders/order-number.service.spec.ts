import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { OrderNumberService } from './order-number.service';
import { OrderCounterDocument } from './schemas';

/**
 * A counter that increments the way MongoDB's `findOneAndUpdate({ $inc })`
 * does: atomically per document, so two callers can never be handed the same
 * value. Modelling it this way is what makes the concurrency test meaningful.
 */
function atomicCounter() {
  const sequences = new Map<string, number>();

  return {
    findOneAndUpdate: jest.fn((filter: { _id: string }) => {
      const next = (sequences.get(filter._id) ?? 0) + 1;
      sequences.set(filter._id, next);
      return { exec: () => Promise.resolve({ sequence: next }) };
    }),
  };
}

function buildService(prefix = 'FC') {
  const counterModel = atomicCounter();
  const configService = {
    get: () => ({ numberPrefix: prefix }),
  } as unknown as ConfigService<AppConfig, true>;

  return {
    counterModel,
    service: new OrderNumberService(
      counterModel as unknown as Model<OrderCounterDocument>,
      configService,
    ),
  };
}

describe('OrderNumberService', () => {
  it('produces a number a shopper can read over the phone', async () => {
    const { service } = buildService();

    // An ObjectId fails every practical test: unreadable aloud, impossible to
    // write on a slip, and it leaks creation time and process identity.
    await expect(service.next(new Date('2026-02-01T10:00:00Z'))).resolves.toBe('FC-2026-0000001');
  });

  it('scopes the sequence by year', async () => {
    const { service } = buildService();

    await service.next(new Date('2026-06-01T10:00:00Z'));
    await service.next(new Date('2026-06-02T10:00:00Z'));

    // A new year restarts at 1, keeping the number short for years.
    await expect(service.next(new Date('2027-01-01T10:00:00Z'))).resolves.toBe('FC-2027-0000001');
  });

  it('honours a configured prefix rather than a hardcoded one', async () => {
    const { service } = buildService('GRO');

    await expect(service.next(new Date('2026-02-01T10:00:00Z'))).resolves.toBe('GRO-2026-0000001');
  });

  it('uses one atomic increment, never a count-then-add', async () => {
    const { service, counterModel } = buildService();

    await service.next(new Date('2026-02-01T10:00:00Z'));

    // `count() + 1` is the read-then-write race that hands two simultaneous
    // checkouts the same number.
    expect(counterModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'FC-2026' },
      { $inc: { sequence: 1 } },
      expect.objectContaining({ upsert: true, new: true }),
    );
  });

  it('gives concurrent checkouts distinct numbers', async () => {
    const { service } = buildService();
    const when = new Date('2026-02-01T10:00:00Z');

    const numbers = await Promise.all(Array.from({ length: 50 }, () => service.next(when)));

    expect(new Set(numbers).size).toBe(50);
  });

  it('pads the sequence so numbers sort and read consistently', async () => {
    const { service } = buildService();
    const when = new Date('2026-02-01T10:00:00Z');

    for (let index = 0; index < 9; index += 1) await service.next(when);

    await expect(service.next(when)).resolves.toBe('FC-2026-0000010');
  });
});

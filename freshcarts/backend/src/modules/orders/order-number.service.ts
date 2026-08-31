import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { OrderCounter, OrderCounterDocument } from './schemas';

/** Zero-padding width. FC-2026-0000001 through FC-2026-9999999. */
const SEQUENCE_WIDTH = 7;

/**
 * Generates the customer-facing order number.
 *
 * Format: `<PREFIX>-<YEAR>-<SEQUENCE>` — e.g. `FC-2026-0001482`.
 *
 * A shopper reads this over the phone, writes it on a slip and searches for it.
 * An ObjectId fails all three: it is 24 hexadecimal characters, unreadable
 * aloud, and it leaks creation time and process identity. So the ObjectId stays
 * the internal key and this is the identifier people use.
 *
 * RACE SAFETY
 * The sequence comes from one atomic `findOneAndUpdate({ $inc }, { upsert })`
 * against a single counter document. MongoDB guarantees that operation is
 * atomic per document, so concurrent checkouts receive distinct sequences with
 * no lock and no retry loop. The unique index on `orders.orderNumber` is the
 * second line of defence: if a number ever did collide, the insert fails rather
 * than two orders sharing an identity.
 *
 * The counter is deliberately incremented OUTSIDE the order transaction. If a
 * transaction aborts, its number is simply never used — a gap in the sequence.
 * Gaps are harmless; the alternative is contention on one hot document for the
 * whole duration of every checkout.
 */
@Injectable()
export class OrderNumberService {
  constructor(
    @InjectModel(OrderCounter.name) private readonly counterModel: Model<OrderCounterDocument>,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async next(now: Date = new Date()): Promise<string> {
    const prefix = this.configService.get('orders', { infer: true }).numberPrefix;
    const year = now.getFullYear();
    const scope = prefix + '-' + year;

    const counter = await this.counterModel
      .findOneAndUpdate(
        { _id: scope },
        { $inc: { sequence: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    return scope + '-' + String(counter.sequence).padStart(SEQUENCE_WIDTH, '0');
  }
}

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OrderCounterDocument = HydratedDocument<OrderCounter>;

export const ORDER_COUNTER_COLLECTION = 'order_counters';

/**
 * One monotonically increasing counter per scope, where a scope is a year:
 * "FC-2026". Sequences reset each year, which keeps the customer-facing number
 * short for far longer than the business will exist.
 *
 * A collection with one small document per year, incremented by
 * `findOneAndUpdate({ $inc })`. That single operation is atomic at the document
 * level in MongoDB, so two simultaneous checkouts are handed 1482 and 1483 —
 * never the same number twice. The alternative people reach for first,
 * `count() + 1`, is a read-then-write race that produces duplicates under
 * exactly the load you least want them under.
 */
@Schema({ timestamps: true, collection: ORDER_COUNTER_COLLECTION })
export class OrderCounter {
  /** The scope key, e.g. "FC-2026". Also the document `_id`. */
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Number, required: true, default: 0 })
  sequence: number;
}

export const OrderCounterSchema = SchemaFactory.createForClass(OrderCounter);

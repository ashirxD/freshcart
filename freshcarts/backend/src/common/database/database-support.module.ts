import { Global, Module } from '@nestjs/common';
import { TransactionRunner } from './transaction.runner';

/**
 * Global because the unit-of-work boundary is infrastructure, not a feature:
 * checkout, orders and any later module that spans collections all need the
 * same runner, and threading it through module imports would add nothing.
 */
@Global()
@Module({
  providers: [TransactionRunner],
  exports: [TransactionRunner],
})
export class DatabaseSupportModule {}

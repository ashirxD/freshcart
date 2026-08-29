import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SeedModule } from './seed.module';
import { SeedService } from './seed.service';

/**
 * CLI entry point.
 *   npm run seed          -> add missing development accounts
 *   npm run seed:fresh    -> wipe seeded collections first
 */
async function main(): Promise<void> {
  const logger = new Logger('Seed');
  const fresh = process.argv.includes('--fresh');

  const context = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const summary = await context.get(SeedService).run({ fresh });
    logger.log('Seed complete: ' + summary.created + ' created, ' + summary.skipped + ' skipped');
  } catch (error) {
    logger.error('Seed failed', error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}

void main();

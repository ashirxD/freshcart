import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SeedModule } from './seed.module';
import { SeedService } from './seed.service';

/**
 * CLI entry point.
 *   npm run seed          -> add anything missing, leave existing data alone
 *   npm run seed:fresh    -> wipe the seeded collections first
 */
async function main(): Promise<void> {
  const logger = new Logger('Seed');
  const fresh = process.argv.includes('--fresh');

  const context = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const summary = await context.get(SeedService).run({ fresh });

    for (const [name, result] of Object.entries(summary)) {
      logger.log(name + ': ' + result.created + ' created, ' + result.skipped + ' skipped');
    }
  } catch (error) {
    logger.error('Seed failed', error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}

void main();

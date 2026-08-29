import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from 'src/common/config/configuration';
import { validateEnv } from 'src/common/config/env.validation';
import { DatabaseModule } from 'src/database/database.module';
import { UsersModule } from 'src/modules/users/users.module';
import { SeedService } from './seed.service';

/**
 * A minimal application context for CLI seeding. It reuses the real services, so
 * seeded data goes through exactly the same validation as production writes.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    UsersModule,
  ],
  providers: [SeedService],
})
export class SeedModule {}

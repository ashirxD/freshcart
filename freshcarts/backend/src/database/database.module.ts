import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfig } from 'src/common/config/configuration';

const logger = new Logger('Database');

/**
 * Single owner of the MongoDB connection. Feature modules never read the URI —
 * they use MongooseModule.forFeature() and stay free of connection concerns.
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        uri: configService.get('database', { infer: true }).uri,
        // Fail fast on a bad URI instead of buffering queries forever.
        serverSelectionTimeoutMS: 5_000,
        autoIndex: !configService.get('isProduction', { infer: true }),
        onConnectionCreate: () => {
          logger.log('MongoDB connection established');
        },
      }),
    }),
  ],
})
export class DatabaseModule {}

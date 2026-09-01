import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformSettings, PlatformSettingsSchema } from './schemas';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/**
 * Business configuration, available everywhere.
 *
 * Global because delivery, checkout and inventory all need it and it depends on
 * nothing — the two conditions under which a global module is the honest choice
 * rather than a shortcut around a dependency problem.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: PlatformSettings.name, schema: PlatformSettingsSchema }]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}

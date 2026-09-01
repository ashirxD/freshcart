import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditService } from './audit.service';
import { AuditLog, AuditLogSchema } from './schemas';

/**
 * The administrative audit trail.
 *
 * Global for the same reason SettingsModule is: it depends on nothing, and the
 * modules that need to record an action — catalogue, inventory, orders, users,
 * delivery — are spread across the whole graph. Importing it explicitly into
 * each would add six import lines to say the same thing, and would tempt a
 * future module to skip recording rather than wire it up.
 *
 * No controller. Reading the log is an administrative operation and lives on
 * the admin surface, beside the other administrative reads.
 */
@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}

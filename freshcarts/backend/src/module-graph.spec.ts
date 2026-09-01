import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { AppModule } from './app.module';
import { SeedModule } from './database/seeds/seed.module';
import { AdminController } from './modules/admin/admin.controller';
import { AdminService } from './modules/admin/admin.service';
import { AuditService } from './modules/audit';
import { SettingsService } from './modules/settings';

/**
 * WIRING TESTS
 * ============
 *
 * These resolve the real dependency graph — every module, every controller,
 * every provider — with only the database connection stubbed.
 *
 * WHY THIS EXISTS: a missing module import is invisible to both `tsc` and
 * `nest build`. TypeScript is perfectly happy with a controller that injects a
 * service its module never imports; the failure appears at startup, as a
 * runtime "Nest can't resolve dependencies" error, on whoever runs the app or
 * the seeder next.
 *
 * That is not hypothetical here. Adding AuditService to the product and
 * category controllers broke `npm run seed` without breaking the build,
 * because SeedModule is a SECOND root context and a @Global module is only
 * global to the context that registers it. This test is what makes that
 * category of mistake fail in CI instead of in someone's terminal.
 */

/**
 * An inert stand-in for a Mongoose model. The graph is what is under test here,
 * never a query, so nothing on it needs to do anything.
 */
const modelStub = { find: () => undefined, findOne: () => undefined, create: () => undefined };

/**
 * Replaces the database connection, and nothing else.
 *
 * `MongooseModule.forFeature` builds each model provider by asking the
 * connection for it (`connection.models[name] ?? connection.model(name, ...)`),
 * so the stub has to answer both — a bare object makes the factory throw before
 * the graph is ever assembled, which would look like a wiring failure and not
 * be one.
 */
function withStubbedDatabase(builder: TestingModuleBuilder): TestingModuleBuilder {
  return builder.overrideProvider(getConnectionToken()).useValue({
    readyState: 1,
    db: null,
    models: {},
    model: () => modelStub,
    on: () => undefined,
    once: () => undefined,
    // Nest calls this through the shutdown hook when the context closes.
    close: () => Promise.resolve(),
  });
}

describe('module graph', () => {
  jest.setTimeout(30_000);

  it('resolves every provider the API needs', async () => {
    const moduleRef = await withStubbedDatabase(
      Test.createTestingModule({ imports: [AppModule] }),
    ).compile();

    // The admin surface specifically: it is the newest, and it reaches across
    // more modules than anything else in the application.
    expect(moduleRef.get(AdminController, { strict: false })).toBeDefined();
    expect(moduleRef.get(AdminService, { strict: false })).toBeDefined();

    await moduleRef.close();
  });

  it('resolves every provider the seeder needs', async () => {
    // The regression this test was written for.
    const moduleRef = await withStubbedDatabase(
      Test.createTestingModule({ imports: [SeedModule] }),
    ).compile();

    await moduleRef.close();
  });

  it('makes settings and the audit trail available in both contexts', async () => {
    // Both are @Global, which is easy to mistake for "available everywhere".
    // It means "available everywhere in the context that registered it".
    for (const rootModule of [AppModule, SeedModule]) {
      const moduleRef = await withStubbedDatabase(
        Test.createTestingModule({ imports: [rootModule] }),
      ).compile();

      expect(moduleRef.get(SettingsService, { strict: false })).toBeDefined();
      expect(moduleRef.get(AuditService, { strict: false })).toBeDefined();

      await moduleRef.close();
    }
  });
});

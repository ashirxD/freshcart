import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { PlatformSettingsDocument } from './schemas';
import { SettingsService } from './settings.service';

const DEFAULTS = {
  key: 'platform',
  maxDeliveryDistanceMeters: 12_000,
  defaultLowStockThreshold: 5,
  orderingEnabled: true,
  supportPhone: '+923000000000',
  supportEmail: 'support@freshcarts.pk',
  updatedAt: new Date('2026-08-31T00:00:00.000Z'),
};

const configService = {
  get: (key: string) =>
    ({
      payments: { enabledMethods: ['CASH_ON_DELIVERY'] },
      routing: { provider: 'estimate' },
      ai: { enabled: true },
    })[key],
} as unknown as ConfigService<AppConfig, true>;

function build(overrides: Record<string, unknown> = {}) {
  const document = { ...DEFAULTS, ...overrides };

  const findOneAndUpdate = jest
    .fn()
    .mockImplementation((_filter, update: Record<string, unknown>) => {
      // Mirrors what Mongo does: `$set` fields land on the returned document.
      const set = (update.$set ?? {}) as Record<string, unknown>;
      Object.assign(document, set);
      return { exec: () => Promise.resolve(document) };
    });

  const model = { findOneAndUpdate } as unknown as Model<PlatformSettingsDocument>;

  return { service: new SettingsService(model, configService), findOneAndUpdate, document };
}

describe('SettingsService', () => {
  it('creates the singleton from schema defaults on first read', async () => {
    const { service, findOneAndUpdate } = build();

    await service.get();

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'platform' },
      // The defaults are NOT restated here — they live in the schema, in one
      // place, so they cannot drift away from it.
      { $setOnInsert: { key: 'platform' } },
      expect.objectContaining({ upsert: true, setDefaultsOnInsert: true }),
    );
  });

  it('memoises the document rather than reading it on every checkout', async () => {
    const { service, findOneAndUpdate } = build();

    await service.maxDeliveryDistanceMeters();
    await service.maxDeliveryDistanceMeters();
    await service.isOrderingEnabled();

    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('clears the cache on a write, so the next read is not stale', async () => {
    const { service, findOneAndUpdate } = build();

    await service.maxDeliveryDistanceMeters();
    await service.update({ maxDeliveryDistanceMeters: 8_000 });
    await service.maxDeliveryDistanceMeters();

    // Read, write, read: three calls, not two — the write invalidated the cache.
    expect(findOneAndUpdate).toHaveBeenCalledTimes(3);
    await expect(service.maxDeliveryDistanceMeters()).resolves.toBe(8_000);
  });

  describe('update', () => {
    it('reports only the fields that genuinely changed', async () => {
      const { service } = build();

      const { changed } = await service.update({
        maxDeliveryDistanceMeters: 8_000,
        // Unchanged: already 5.
        defaultLowStockThreshold: 5,
      });

      expect(changed).toEqual({
        maxDeliveryDistanceMeters: { from: 12_000, to: 8_000 },
      });
    });

    it('writes nothing when nothing changed', async () => {
      const { service, findOneAndUpdate } = build();

      await service.get();
      findOneAndUpdate.mockClear();

      const { changed } = await service.update({ orderingEnabled: true });

      expect(changed).toEqual({});
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('ignores undefined fields, so a partial save does not blank the rest', async () => {
      const { service } = build();

      await service.update({ orderingEnabled: false, supportPhone: undefined });

      const view = await service.view();
      expect(view.orderingEnabled).toBe(false);
      expect(view.supportPhone).toBe('+923000000000');
    });

    it('runs schema validators on the write', async () => {
      const { service, findOneAndUpdate } = build();

      await service.update({ maxDeliveryDistanceMeters: 8_000 });

      expect(findOneAndUpdate).toHaveBeenLastCalledWith(
        { key: 'platform' },
        { $set: { maxDeliveryDistanceMeters: 8_000 } },
        expect.objectContaining({ runValidators: true }),
      );
    });
  });

  describe('views', () => {
    it('shows deployment facts as read-only context on the admin view', async () => {
      const { service } = build();

      const view = await service.view();

      // Section 25: these are environment configuration and are deliberately
      // not editable from a web form — they are shown so an admin is not left
      // guessing why behaviour they cannot find a switch for is the way it is.
      expect(view.environment).toEqual({
        paymentMethods: ['CASH_ON_DELIVERY'],
        routingProvider: 'estimate',
        aiServiceEnabled: true,
      });
    });

    it('exposes only four fields publicly', async () => {
      const { service } = build();

      expect(Object.keys(await service.publicView()).sort()).toEqual([
        'maxDeliveryDistanceMeters',
        'orderingEnabled',
        'supportEmail',
        'supportPhone',
      ]);
    });
  });
});

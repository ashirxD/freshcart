import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { ErrorCode } from 'src/common/errors';
import { StoreDocument } from './schemas';
import { StoresService } from './stores.service';

/** Store-local time is UTC+5 (Pakistan), which is what the default configures. */
const PKT_OFFSET_MINUTES = 300;

function buildService(offsetMinutes = PKT_OFFSET_MINUTES) {
  const configService = {
    get: () => ({ defaultSlug: undefined, timezoneOffsetMinutes: offsetMinutes }),
  } as unknown as ConfigService<AppConfig, true>;

  return new StoresService({} as unknown as Model<StoreDocument>, configService);
}

function store(overrides: Partial<StoreDocument> = {}): StoreDocument {
  return {
    name: 'FreshCarts Gulberg',
    isActive: true,
    // Open 08:00-23:00 every day.
    openingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      opensAt: '08:00',
      closesAt: '23:00',
      isClosed: false,
    })),
    ...overrides,
  } as StoreDocument;
}

/** A UTC instant that is `hhmm` store-local time on a Monday. */
function atStoreLocal(hours: number, minutes = 0): Date {
  // 2026-02-02 is a Monday. Subtract the offset to get the UTC instant.
  return new Date(Date.UTC(2026, 1, 2, hours, minutes) - PKT_OFFSET_MINUTES * 60_000);
}

describe('StoresService — accepting orders', () => {
  const service = buildService();

  it('accepts an order in the middle of the day', () => {
    expect(service.isAcceptingOrders(store(), atStoreLocal(14))).toBe(true);
  });

  it('accepts an order at exactly the opening minute', () => {
    expect(service.isAcceptingOrders(store(), atStoreLocal(8, 0))).toBe(true);
  });

  it('refuses one minute before opening', () => {
    expect(service.isAcceptingOrders(store(), atStoreLocal(7, 59))).toBe(false);
  });

  it('refuses at exactly the closing minute', () => {
    // The window is half-open, matching how a shop actually works: at 23:00 the
    // shutters are coming down, and an order placed then cannot be picked.
    expect(service.isAcceptingOrders(store(), atStoreLocal(23, 0))).toBe(false);
  });

  it('accepts one minute before closing', () => {
    expect(service.isAcceptingOrders(store(), atStoreLocal(22, 59))).toBe(true);
  });

  it('refuses overnight', () => {
    expect(service.isAcceptingOrders(store(), atStoreLocal(2))).toBe(false);
  });

  it('refuses an inactive store at any hour', () => {
    expect(service.isAcceptingOrders(store({ isActive: false }), atStoreLocal(14))).toBe(false);
  });

  it('refuses on a day the store marked closed', () => {
    const closedMonday = store({
      openingHours: [{ day: 1, opensAt: '08:00', closesAt: '23:00', isClosed: true }],
    } as Partial<StoreDocument>);

    expect(service.isAcceptingOrders(closedMonday, atStoreLocal(14))).toBe(false);
  });

  it('treats a store with no published hours as always open', () => {
    // "No data" must not silently close a shop.
    const noHours = store({ openingHours: [] } as Partial<StoreDocument>);

    expect(service.isAcceptingOrders(noHours, atStoreLocal(3))).toBe(true);
  });

  it('treats a day with no entry as open rather than closed', () => {
    const weekdaysOnly = store({
      openingHours: [{ day: 3, opensAt: '08:00', closesAt: '23:00', isClosed: false }],
    } as Partial<StoreDocument>);

    // Monday has no entry: the store did not publish hours for it, which is
    // different from declaring itself shut.
    expect(service.isAcceptingOrders(weekdaysOnly, atStoreLocal(14))).toBe(true);
  });

  it('reads the clock in store-local time, not the server’s', () => {
    // 09:00 in Pakistan is 04:00 UTC. The same instant is inside opening hours
    // for a PKT store and outside them for a store on UTC — which is exactly
    // why the offset is configuration rather than the server's own clock.
    const instant = atStoreLocal(9);

    expect(buildService(PKT_OFFSET_MINUTES).isAcceptingOrders(store(), instant)).toBe(true);
    expect(buildService(0).isAcceptingOrders(store(), instant)).toBe(false);
  });

  describe('assertAcceptingOrders', () => {
    it('explains a closed store in words a shopper can act on', async () => {
      const closed = buildService();
      jest.spyOn(closed, 'findActiveStore').mockResolvedValue(store());
      jest.spyOn(closed, 'isAcceptingOrders').mockReturnValue(false);

      await expect(closed.assertAcceptingOrders()).rejects.toMatchObject({
        code: ErrorCode.STORE_UNAVAILABLE,
      });
    });

    it('returns the store when it is open', async () => {
      const open = buildService();
      const document = store();
      jest.spyOn(open, 'findActiveStore').mockResolvedValue(document);
      jest.spyOn(open, 'isAcceptingOrders').mockReturnValue(true);

      await expect(open.assertAcceptingOrders()).resolves.toBe(document);
    });
  });
});

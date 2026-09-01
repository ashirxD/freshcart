import { Model, Types } from 'mongoose';
import { Role } from 'src/common/enums';
import { AuditService } from './audit.service';
import { AuditAction, AuditEntity, AuditLogDocument } from './schemas';

const ACTOR = { userId: '64b000000000000000000009', role: Role.ADMIN };

/**
 * SANITISATION IS THE SECURITY-CRITICAL PART OF THIS SERVICE.
 *
 * Section 27 forbids passwords, tokens and payment secrets in the audit trail.
 * A log is read by more people, and retained longer, than the database it
 * describes, so a credential that reaches one of these rows is a credential
 * that has leaked. These tests are the enforcement.
 */
describe('AuditService.sanitiseMetadata', () => {
  it('keeps identifiers and small scalars', () => {
    expect(
      AuditService.sanitiseMetadata({ sku: 'MLK-001', quantity: 12, isActive: false }),
    ).toEqual({ sku: 'MLK-001', quantity: 12, isActive: false });
  });

  it.each([
    'password',
    'passwordHash',
    'newPassword',
    'currentPassword',
    'token',
    'accessToken',
    'refreshToken',
    'refreshTokenHash',
    'authorization',
    'secret',
    'apiKey',
    'cookie',
    'cvv',
    'cardNumber',
  ])('drops %s whatever the caller passes', (key) => {
    const clean = AuditService.sanitiseMetadata({ [key]: 'super-secret-value', sku: 'MLK-001' });

    expect(clean).not.toHaveProperty(key);
    expect(clean).toEqual({ sku: 'MLK-001' });
  });

  it('matches forbidden keys case-insensitively', () => {
    // A caller spreading a DTO could produce any casing; the check must not be
    // defeated by one of them.
    expect(AuditService.sanitiseMetadata({ PassWord: 'x', PASSWORDHASH: 'y' })).toEqual({});
  });

  it('drops nested objects rather than recursing into them', () => {
    // Recursion is how a whole request body gets in through a field nobody
    // inspected. A value worth auditing is a scalar.
    expect(
      AuditService.sanitiseMetadata({
        sku: 'MLK-001',
        body: { password: 'hunter2', address: 'House 4, Gulberg' },
        items: [{ price: 100 }],
      }),
    ).toEqual({ sku: 'MLK-001' });
  });

  it('truncates long strings so one row cannot grow unboundedly', () => {
    const clean = AuditService.sanitiseMetadata({ reason: 'x'.repeat(5_000) });

    expect((clean.reason as string).length).toBe(200);
  });

  it('caps the number of keys', () => {
    const wide = Object.fromEntries(Array.from({ length: 100 }, (_, i) => ['k' + i, i]));

    expect(Object.keys(AuditService.sanitiseMetadata(wide))).toHaveLength(20);
  });

  it('normalises dates and ObjectIds to strings', () => {
    const id = new Types.ObjectId('64b000000000000000000001');
    const when = new Date('2026-08-31T10:00:00.000Z');

    expect(AuditService.sanitiseMetadata({ id, when })).toEqual({
      id: '64b000000000000000000001',
      when: '2026-08-31T10:00:00.000Z',
    });
  });

  it('treats undefined and null as absent rather than storing them', () => {
    expect(AuditService.sanitiseMetadata({ a: undefined, b: null, c: 1 })).toEqual({ c: 1 });
  });

  it('returns an empty object when there is no metadata at all', () => {
    expect(AuditService.sanitiseMetadata(undefined)).toEqual({});
  });
});

describe('AuditService.record', () => {
  function build(create: jest.Mock) {
    return new AuditService({ create } as unknown as Model<AuditLogDocument>);
  }

  it('attributes the row to the actor and sanitises the metadata', async () => {
    const create = jest.fn().mockResolvedValue({});
    await build(create).record({
      actor: ACTOR,
      action: AuditAction.PRODUCT_STATUS_CHANGED,
      entityType: AuditEntity.PRODUCT,
      entityId: '64b000000000000000000002',
      metadata: { sku: 'MLK-001', password: 'leaked' },
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: Role.ADMIN,
        action: AuditAction.PRODUCT_STATUS_CHANGED,
        entityType: AuditEntity.PRODUCT,
        entityId: '64b000000000000000000002',
        metadata: { sku: 'MLK-001' },
      }),
    );
  });

  it('never throws when the write fails', async () => {
    // A failed audit write must not turn a successful product edit into a 500
    // the admin then retries — producing the double-write the log exists to
    // help investigate.
    const create = jest.fn().mockRejectedValue(new Error('collection is read-only'));

    await expect(
      build(create).record({
        actor: ACTOR,
        action: AuditAction.SETTINGS_UPDATED,
        entityType: AuditEntity.SETTINGS,
        entityId: 'platform',
      }),
    ).resolves.toBeUndefined();
  });
});

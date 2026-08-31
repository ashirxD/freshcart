import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { AddressesService } from './addresses.service';
import { formatAddress } from './address.view';
import { AddressDocument, AddressLabel, MAX_ADDRESSES_PER_USER } from './schemas';

const USER_ID = '64b000000000000000000009';
const OTHER_USER_ID = '64b000000000000000000010';
const ADDRESS_ID = '64b0000000000000000000a1';

function addressDocument(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(ADDRESS_ID),
    userId: new Types.ObjectId(USER_ID),
    label: AddressLabel.HOME,
    recipientName: 'Ayesha Khan',
    phone: '+923001234569',
    houseNumber: '42-B',
    street: 'Street 4',
    area: 'Salamatpura',
    city: 'Lahore',
    landmark: null,
    deliveryInstructions: null,
    latitude: 31.545,
    longitude: 74.372,
    isDefault: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

const validPayload = {
  recipientName: 'Ayesha Khan',
  phone: '+923001234569',
  houseNumber: '42-B',
  street: 'Street 4',
  area: 'Salamatpura',
  city: 'Lahore',
};

describe('AddressesService', () => {
  type MockModel = Record<string, jest.Mock>;

  let addressModel: MockModel;
  let service: AddressesService;

  beforeEach(() => {
    addressModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndDelete: jest.fn(),
      countDocuments: jest.fn().mockReturnValue({ exec: () => Promise.resolve(0) }),
      create: jest.fn(),
      updateOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve(undefined) }),
      updateMany: jest.fn().mockReturnValue({ exec: () => Promise.resolve(undefined) }),
    };

    service = new AddressesService(addressModel as unknown as Model<AddressDocument>);
  });

  describe('ownership', () => {
    it('scopes every lookup by the authenticated user, not by id alone', async () => {
      addressModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(addressDocument()) }),
      });

      await service.findOneOrFail(USER_ID, ADDRESS_ID);

      // The ownership check IS the query. There is no separate comparison that
      // a future edit could omit.
      expect(addressModel.findOne).toHaveBeenCalledWith({
        _id: new Types.ObjectId(ADDRESS_ID),
        userId: new Types.ObjectId(USER_ID),
      });
    });

    it('reports another shopper’s address as missing, not forbidden', async () => {
      addressModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });

      // "Forbidden" would confirm the id exists, which is itself a small leak.
      await expect(service.findOneOrFail(OTHER_USER_ID, ADDRESS_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('scopes deletion by owner too', async () => {
      addressModel.findOneAndDelete.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });

      await expect(service.remove(OTHER_USER_ID, ADDRESS_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(addressModel.findOneAndDelete).toHaveBeenCalledWith({
        _id: new Types.ObjectId(ADDRESS_ID),
        userId: new Types.ObjectId(OTHER_USER_ID),
      });
    });

    it('rejects a malformed id without touching the database', async () => {
      await expect(service.findOneOrFail(USER_ID, 'not-an-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(addressModel.findOne).not.toHaveBeenCalled();
    });
  });

  describe('the default address', () => {
    it('makes the first saved address the default without being asked', async () => {
      addressModel.countDocuments.mockReturnValue({ exec: () => Promise.resolve(0) });
      addressModel.create.mockResolvedValue({
        toObject: () => addressDocument({ isDefault: true }),
        label: AddressLabel.HOME,
      });

      const created = await service.create(USER_ID, validPayload);

      // Otherwise checkout opens with addresses saved but none selected.
      expect(created.isDefault).toBe(true);
    });

    it('does not make a later address default unless asked', async () => {
      addressModel.countDocuments.mockReturnValue({ exec: () => Promise.resolve(2) });
      addressModel.create.mockResolvedValue({
        toObject: () => addressDocument({ isDefault: false }),
        label: AddressLabel.WORK,
      });

      await service.create(USER_ID, validPayload);

      const created = addressModel.create.mock.calls[0][0] as { isDefault: boolean };
      expect(created.isDefault).toBe(false);
      expect(addressModel.updateMany).not.toHaveBeenCalled();
    });

    it('clears the previous default before promoting a new one', async () => {
      addressModel.countDocuments.mockReturnValue({ exec: () => Promise.resolve(2) });
      addressModel.create.mockResolvedValue({
        toObject: () => addressDocument(),
        label: AddressLabel.HOME,
      });

      await service.create(USER_ID, { ...validPayload, isDefault: true });

      // Order matters: the partial unique index rejects a second default, so
      // the old one has to go first.
      expect(addressModel.updateMany).toHaveBeenCalledWith(
        { userId: new Types.ObjectId(USER_ID), isDefault: true },
        { $set: { isDefault: false } },
      );
    });

    it('promotes another address when the default is deleted', async () => {
      addressModel.findOneAndDelete.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(addressDocument({ isDefault: true })) }),
      });
      addressModel.findOne.mockReturnValue({
        sort: () => ({
          select: () => ({ exec: () => Promise.resolve({ _id: new Types.ObjectId() }) }),
        }),
      });

      await service.remove(USER_ID, ADDRESS_ID);

      expect(addressModel.updateOne).toHaveBeenCalledWith(expect.anything(), {
        $set: { isDefault: true },
      });
    });

    it('does not promote anything when a non-default address is deleted', async () => {
      addressModel.findOneAndDelete.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(addressDocument({ isDefault: false })) }),
      });

      await service.remove(USER_ID, ADDRESS_ID);

      expect(addressModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('never lets a client choose the owner', async () => {
      addressModel.create.mockResolvedValue({
        toObject: () => addressDocument(),
        label: AddressLabel.HOME,
      });

      // A client sending userId gets it stripped by the DTO's whitelist; even
      // if one arrived, the service writes the authenticated id over the top.
      await service.create(USER_ID, {
        ...validPayload,
        ...({ userId: OTHER_USER_ID } as object),
      });

      const written = addressModel.create.mock.calls[0][0] as { userId: Types.ObjectId };
      expect(written.userId).toEqual(new Types.ObjectId(USER_ID));
    });

    it('stores coordinates as null when none were given', async () => {
      addressModel.create.mockResolvedValue({
        toObject: () => addressDocument({ latitude: null, longitude: null }),
        label: AddressLabel.HOME,
      });

      const created = await service.create(USER_ID, validPayload);

      expect(created.latitude).toBeNull();
      // The flag checkout uses to explain why delivery is unavailable.
      expect(created.hasCoordinates).toBe(false);
    });

    it('refuses to exceed the address-book limit', async () => {
      addressModel.countDocuments.mockReturnValue({
        exec: () => Promise.resolve(MAX_ADDRESSES_PER_USER),
      });

      await expect(service.create(USER_ID, validPayload)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('leaves fields that were not sent alone', async () => {
      const document = {
        ...addressDocument(),
        save: jest.fn().mockResolvedValue(undefined),
        toObject: jest.fn(),
      };
      document.toObject.mockReturnValue(document);
      addressModel.findOne.mockReturnValue({ exec: () => Promise.resolve(document) });

      await service.update(USER_ID, ADDRESS_ID, { street: 'Street 9' });

      expect(document.street).toBe('Street 9');
      // `undefined` means "not sent"; it must never clear a stored value.
      expect(document.recipientName).toBe('Ayesha Khan');
      expect(document.city).toBe('Lahore');
    });

    it('moves the map pin only when both coordinates arrive', async () => {
      const document = {
        ...addressDocument(),
        save: jest.fn().mockResolvedValue(undefined),
        toObject: jest.fn(),
      };
      document.toObject.mockReturnValue(document);
      addressModel.findOne.mockReturnValue({ exec: () => Promise.resolve(document) });

      await service.update(USER_ID, ADDRESS_ID, { latitude: 31.6, longitude: 74.4 });

      expect(document.latitude).toBe(31.6);
      expect(document.longitude).toBe(74.4);
    });
  });

  describe('formatAddress', () => {
    it('reads the way a rider would be told it: door, street, area, city', () => {
      expect(
        formatAddress({
          houseNumber: '42-B',
          street: 'Street 4',
          area: 'Salamatpura',
          city: 'Lahore',
        }),
      ).toBe('42-B, Street 4, Salamatpura, Lahore');
    });

    it('appends the landmark as the hint it is', () => {
      expect(
        formatAddress({
          houseNumber: '42-B',
          street: 'Street 4',
          area: 'Salamatpura',
          city: 'Lahore',
          landmark: 'Al-Fatah',
        }),
      ).toBe('42-B, Street 4, Salamatpura, Lahore (near Al-Fatah)');
    });
  });
});

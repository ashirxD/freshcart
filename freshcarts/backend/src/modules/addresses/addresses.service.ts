import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateAddressDto, UpdateAddressDto } from './dto';
import { AddressView, LeanAddress, toAddressView } from './address.view';
import { Address, AddressDocument, MAX_ADDRESSES_PER_USER } from './schemas';

/**
 * The address book.
 *
 * Ownership is not a check bolted onto each method — it is in the filter of
 * every query. `userId` always comes from the authenticated principal and is
 * always part of the `findOne`, so an address belonging to someone else
 * resolves to "not found" without a separate comparison that could be
 * forgotten. That is what closes the IDOR surface here.
 */
@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);

  constructor(@InjectModel(Address.name) private readonly addressModel: Model<AddressDocument>) {}

  /** Default first, then most recently used. Bounded by MAX_ADDRESSES_PER_USER. */
  async list(userId: string): Promise<AddressView[]> {
    const addresses = await this.addressModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ isDefault: -1, updatedAt: -1 })
      .limit(MAX_ADDRESSES_PER_USER)
      .lean<LeanAddress[]>()
      .exec();

    return addresses.map(toAddressView);
  }

  async findOneOrFail(userId: string, addressId: string): Promise<AddressView> {
    return toAddressView(await this.loadOwnedOrFail(userId, addressId));
  }

  async create(userId: string, dto: CreateAddressDto): Promise<AddressView> {
    const owner = new Types.ObjectId(userId);
    const existing = await this.addressModel.countDocuments({ userId: owner }).exec();

    if (existing >= MAX_ADDRESSES_PER_USER) {
      throw new BadRequestException(
        'You can save up to ' + MAX_ADDRESSES_PER_USER + ' addresses. Remove one to add another.',
      );
    }

    // The first address a shopper saves is their default whether they asked or
    // not — otherwise checkout would open with nothing selected.
    const shouldBeDefault = dto.isDefault === true || existing === 0;

    if (shouldBeDefault) await this.clearDefault(owner);

    const address = await this.addressModel.create({
      ...this.writableFields(dto),
      userId: owner,
      isDefault: shouldBeDefault,
    });

    this.logger.log('Address created for user ' + userId + ' (' + address.label + ')');

    return toAddressView(address.toObject<LeanAddress>());
  }

  async update(userId: string, addressId: string, dto: UpdateAddressDto): Promise<AddressView> {
    const owner = new Types.ObjectId(userId);

    if (!Types.ObjectId.isValid(addressId)) throw new NotFoundException('Address not found');

    const address = await this.addressModel
      .findOne({ _id: new Types.ObjectId(addressId), userId: owner })
      .exec();

    if (!address) throw new NotFoundException('Address not found');

    // Assigned field by field: `undefined` means "not sent" and must not clear a
    // stored value, and only these properties are writable at all.
    if (dto.label !== undefined) address.label = dto.label;
    if (dto.nickname !== undefined) address.nickname = dto.nickname.trim();
    if (dto.recipientName !== undefined) address.recipientName = dto.recipientName.trim();
    if (dto.phone !== undefined) address.phone = dto.phone;
    if (dto.houseNumber !== undefined) address.houseNumber = dto.houseNumber.trim();
    if (dto.street !== undefined) address.street = dto.street.trim();
    if (dto.area !== undefined) address.area = dto.area.trim();
    if (dto.city !== undefined) address.city = dto.city.trim();
    if (dto.landmark !== undefined) address.landmark = dto.landmark.trim();
    if (dto.deliveryInstructions !== undefined) {
      address.deliveryInstructions = dto.deliveryInstructions.trim();
    }

    // Paired by DTO validation, so one present implies the other.
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      address.latitude = dto.latitude;
      address.longitude = dto.longitude;
    }

    // Promoting to default must clear the previous one first, or the partial
    // unique index rejects the save.
    if (dto.isDefault === true && !address.isDefault) {
      await this.clearDefault(owner, address._id);
      address.isDefault = true;
    }

    await address.save();

    return toAddressView(address.toObject<LeanAddress>());
  }

  /**
   * Deleting the default promotes the next most recent address, so a shopper
   * never lands on checkout with addresses saved but none selected.
   */
  async remove(userId: string, addressId: string): Promise<{ deleted: true; id: string }> {
    const owner = new Types.ObjectId(userId);

    if (!Types.ObjectId.isValid(addressId)) throw new NotFoundException('Address not found');

    const address = await this.addressModel
      .findOneAndDelete({ _id: new Types.ObjectId(addressId), userId: owner })
      .lean<LeanAddress>()
      .exec();

    if (!address) throw new NotFoundException('Address not found');

    if (address.isDefault) {
      const replacement = await this.addressModel
        .findOne({ userId: owner })
        .sort({ updatedAt: -1 })
        .select('_id')
        .exec();

      if (replacement) {
        await this.addressModel
          .updateOne({ _id: replacement._id }, { $set: { isDefault: true } })
          .exec();
      }
    }

    return { deleted: true, id: addressId };
  }

  async setDefault(userId: string, addressId: string): Promise<AddressView> {
    return this.update(userId, addressId, { isDefault: true });
  }

  /**
   * The lookup checkout uses.
   *
   * Returns the raw document rather than the view because the delivery
   * calculation needs the coordinates and the order needs a snapshot — and
   * scoping by `userId` here is what stops a client from checking out to an
   * address id it does not own.
   */
  async findOwnedOrFail(userId: string, addressId: string): Promise<LeanAddress> {
    return this.loadOwnedOrFail(userId, addressId);
  }

  /** Used to preselect an address when checkout opens. */
  async findDefault(userId: string): Promise<AddressView | null> {
    const address = await this.addressModel
      .findOne({ userId: new Types.ObjectId(userId), isDefault: true })
      .lean<LeanAddress>()
      .exec();

    return address ? toAddressView(address) : null;
  }

  private async loadOwnedOrFail(userId: string, addressId: string): Promise<LeanAddress> {
    if (!Types.ObjectId.isValid(addressId)) throw new NotFoundException('Address not found');

    const address = await this.addressModel
      .findOne({ _id: new Types.ObjectId(addressId), userId: new Types.ObjectId(userId) })
      .lean<LeanAddress>()
      .exec();

    // Deliberately "not found", not "forbidden": confirming that an address id
    // exists but belongs to someone else is itself a small information leak.
    if (!address) throw new NotFoundException('Address not found');

    return address;
  }

  private async clearDefault(userId: Types.ObjectId, except?: Types.ObjectId): Promise<void> {
    await this.addressModel
      .updateMany(
        { userId, isDefault: true, ...(except ? { _id: { $ne: except } } : {}) },
        { $set: { isDefault: false } },
      )
      .exec();
  }

  /** The subset of a payload that may reach the document. `userId` is not in it. */
  private writableFields(dto: CreateAddressDto) {
    return {
      label: dto.label,
      nickname: dto.nickname?.trim(),
      recipientName: dto.recipientName.trim(),
      phone: dto.phone,
      houseNumber: dto.houseNumber.trim(),
      street: dto.street.trim(),
      area: dto.area.trim(),
      city: dto.city.trim(),
      landmark: dto.landmark?.trim(),
      deliveryInstructions: dto.deliveryInstructions?.trim(),
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    };
  }
}

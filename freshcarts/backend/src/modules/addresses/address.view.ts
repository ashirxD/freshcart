import { Types } from 'mongoose';
import { Address, AddressLabel } from './schemas';

/** The address shape that crosses the API boundary. */
export interface AddressView {
  id: string;
  label: AddressLabel;
  nickname?: string;
  recipientName: string;
  phone: string;
  houseNumber: string;
  street: string;
  area: string;
  city: string;
  landmark?: string;
  deliveryInstructions?: string;
  latitude: number | null;
  longitude: number | null;
  /**
   * Server-computed, so the client never has to know that delivery needs a
   * geocode — it just disables the address with an explanation.
   */
  hasCoordinates: boolean;
  isDefault: boolean;
  /** One-line rendering, so every surface shows the address identically. */
  formatted: string;
  createdAt: Date;
  updatedAt: Date;
}

export type LeanAddress = Address & { _id: Types.ObjectId };

/**
 * The single definition of how a Pakistani address reads on one line.
 *
 * Ordered the way a rider would be told it: door, street, area, city — with the
 * landmark last, because it is a hint rather than part of the address.
 */
export function formatAddress(address: {
  houseNumber: string;
  street: string;
  area: string;
  city: string;
  landmark?: string;
}): string {
  const parts = [address.houseNumber, address.street, address.area, address.city].filter(Boolean);
  const line = parts.join(', ');

  return address.landmark ? line + ' (near ' + address.landmark + ')' : line;
}

export function toAddressView(address: LeanAddress): AddressView {
  return {
    id: address._id.toString(),
    label: address.label,
    nickname: address.nickname,
    recipientName: address.recipientName,
    phone: address.phone,
    houseNumber: address.houseNumber,
    street: address.street,
    area: address.area,
    city: address.city,
    landmark: address.landmark,
    deliveryInstructions: address.deliveryInstructions,
    latitude: address.latitude,
    longitude: address.longitude,
    hasCoordinates: address.latitude !== null && address.longitude !== null,
    isDefault: address.isDefault,
    formatted: formatAddress(address),
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
}

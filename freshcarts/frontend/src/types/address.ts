export type AddressLabel = 'HOME' | 'WORK' | 'OTHER';

export interface Address {
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
   * Server-computed. The UI disables delivery for an address without it and
   * explains why, rather than the client knowing that routing needs a geocode.
   */
  hasCoordinates: boolean;
  isDefault: boolean;
  /** One-line rendering, so every surface shows the address identically. */
  formatted: string;
  createdAt: string;
  updatedAt: string;
}

/** The payload for creating or editing an address. `userId` is never sent. */
export interface AddressInput {
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
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

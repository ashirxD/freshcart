import enAdmin from './messages/en/admin.json';
import enCheckout from './messages/en/checkout.json';
import enCommon from './messages/en/common.json';
import enCustomer from './messages/en/customer.json';
import enOcr from './messages/en/ocr.json';
import enOrders from './messages/en/orders.json';
import enStore from './messages/en/store.json';
import urAdmin from './messages/ur/admin.json';
import urCheckout from './messages/ur/checkout.json';
import urCommon from './messages/ur/common.json';
import urCustomer from './messages/ur/customer.json';
import urOcr from './messages/ur/ocr.json';
import urOrders from './messages/ur/orders.json';
import urStore from './messages/ur/store.json';
import type { Locale } from './config';

/**
 * THE DICTIONARIES
 *
 * One folder of JSON per language, split by area so a file stays readable and a
 * translator can take one area at a time. Each file contributes whole top-level
 * groups (`common`, `cart`, `checkout`, `admin`…), and the groups are merged
 * here into the single tree every key is looked up in.
 *
 * English is the SOURCE: it defines the shape. The Urdu tree is checked against
 * it by the compiler (`satisfies`), so a key added in English and forgotten in
 * Urdu is a build error, not a hole a shopper falls into. At runtime a missing
 * Urdu string still falls back to English rather than showing a blank (see
 * `translate`), because a JSON file can be edited outside the compiler's sight.
 */
export const en = {
  ...enCommon,
  ...enCustomer,
  ...enCheckout,
  ...enOrders,
  ...enOcr,
  ...enStore,
  ...enAdmin,
};

export type Messages = typeof en;

const ur = {
  ...urCommon,
  ...urCustomer,
  ...urCheckout,
  ...urOrders,
  ...urOcr,
  ...urStore,
  ...urAdmin,
} satisfies Messages;

export const dictionaries: Record<Locale, Messages> = { en, ur };

// --- Keys, derived from the English tree --------------------------------------

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/**
 * Plural forms are stored as `key_one` / `key_other` and asked for as `key`
 * with a `count`, so the call site never names a plural form.
 */
type PluralBase<K extends string> = K extends `${infer Base}_${'one' | 'other'}` ? Base : K;

export type TranslationKey = PluralBase<Leaves<Messages>>;

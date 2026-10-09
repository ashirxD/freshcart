import { describe, expect, it } from 'vitest';
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

/**
 * THE DICTIONARIES, AS DATA
 *
 * The compiler already refuses an Urdu tree whose KEYS differ from English
 * (`satisfies Messages`). These tests cover what a type cannot see: that every
 * namespace file contributes distinct groups (a shallow merge would let one
 * silently overwrite another), that placeholders and plural forms line up, that
 * nothing was saved with broken encoding, and that "Urdu" strings are Urdu.
 */

type Tree = { [key: string]: string | Tree };

const FILES: Record<string, { en: Tree; ur: Tree }> = {
  common: { en: enCommon, ur: urCommon },
  customer: { en: enCustomer, ur: urCustomer },
  checkout: { en: enCheckout, ur: urCheckout },
  orders: { en: enOrders, ur: urOrders },
  ocr: { en: enOcr, ur: urOcr },
  store: { en: enStore, ur: urStore },
  admin: { en: enAdmin, ur: urAdmin },
};

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') out[prefix + key] = value;
    else Object.assign(out, flatten(value, prefix + key + '.'));
  }

  return out;
}

function merged(language: 'en' | 'ur'): Record<string, string> {
  return Object.assign({}, ...Object.values(FILES).map((pair) => flatten(pair[language])));
}

const en = merged('en');
const ur = merged('ur');

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('has the same keys in English and Urdu', () => {
    const missingInUrdu = Object.keys(en).filter((key) => !(key in ur));
    const extraInUrdu = Object.keys(ur).filter((key) => !(key in en));

    expect(missingInUrdu).toEqual([]);
    expect(extraInUrdu).toEqual([]);
  });

  it('is not an empty shell', () => {
    expect(Object.keys(en).length).toBeGreaterThan(1000);
  });

  it('gives every namespace file its own top-level groups', () => {
    // The files are merged with a shallow spread, so two files sharing a group
    // name would overwrite one another without a single error.
    for (const language of ['en', 'ur'] as const) {
      const owners = new Map<string, string[]>();

      for (const [file, pair] of Object.entries(FILES)) {
        for (const group of Object.keys(pair[language])) {
          owners.set(group, [...(owners.get(group) ?? []), file]);
        }
      }

      const collisions = [...owners].filter(([, files]) => files.length > 1);
      expect(collisions).toEqual([]);
    }
  });

  it('uses the same {placeholders} in both languages, so no value is dropped or invented', () => {
    const mismatched = Object.keys(en)
      .filter((key) => key in ur)
      .filter((key) => placeholders(en[key]).join() !== placeholders(ur[key]).join());

    expect(mismatched).toEqual([]);
  });

  it('defines both plural forms wherever it defines one, in both languages', () => {
    for (const dictionary of [en, ur]) {
      const keys = new Set(Object.keys(dictionary));
      const incomplete = [...keys].filter((key) => {
        if (key.endsWith('_one')) return !keys.has(key.slice(0, -4) + '_other');
        if (key.endsWith('_other')) return !keys.has(key.slice(0, -6) + '_one');
        return false;
      });

      expect(incomplete).toEqual([]);
    }
  });

  it('has no empty strings', () => {
    expect(Object.entries(en).filter(([, value]) => value.trim() === '')).toEqual([]);
    expect(Object.entries(ur).filter(([, value]) => value.trim() === '')).toEqual([]);
  });

  it('has no mojibake or replacement characters from a bad encoding round trip', () => {
    const broken = /â€|Ã.|ï¿½|�|Ø§|Ù\u0085/;

    for (const dictionary of [en, ur]) {
      expect(Object.entries(dictionary).filter(([, value]) => broken.test(value))).toEqual([]);
    }
  });

  describe('the Urdu text', () => {
    /**
     * Strings that are the same in both languages on purpose: a brand, an
     * example someone is meant to type, or a template made only of placeholders.
     */
    const SAME_ON_PURPOSE = new Set([
      'language.english',
      'language.urdu',
      'quantity.value',
      'catalog.priceBetween',
      'auth.register.emailPlaceholder',
      'store.orders.orderNumberPlaceholder',
      'admin.who.SYSTEM',
      'admin.orderDetail.cancelledBy',
      'admin.productForm.skuPlaceholder',
      'admin.productForm.alsoFindablePlaceholder',
      'admin.categories.rowSummary',
      'admin.audit.line',
    ]);

    it('is actually translated, apart from a short list of strings that are the same on purpose', () => {
      const untranslated = Object.keys(en).filter(
        (key) => ur[key] === en[key] && !SAME_ON_PURPOSE.has(key),
      );

      expect(untranslated).toEqual([]);
    });

    it('is written in Urdu script', () => {
      const withoutArabicScript = Object.keys(ur).filter(
        (key) =>
          !SAME_ON_PURPOSE.has(key) &&
          !/[؀-ۿ]/.test(ur[key]) &&
          // A value that is only placeholders and punctuation has no words to translate.
          ur[key].replace(/\{\w+\}|[\s\d·—–×.,:;/()+\-…]/g, '') !== '',
      );

      expect(withoutArabicScript).toEqual([]);
    });
  });
});

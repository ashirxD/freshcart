import { afterEach, describe, expect, it, vi } from 'vitest';
import { INTL_TAGS, LOCALES, directionOf, isLocale } from './config';
import { dictionaries, type TranslationKey } from './messages';
import {
  isolateLtr,
  ltrNow,
  setActiveLocale,
  tNow,
  translate,
  translateIfKnown,
  translateMessage,
  translateTemplate,
} from './translate';

const ARABIC_SCRIPT = /[؀-ۿ]/;

afterEach(() => {
  setActiveLocale('en');
});

describe('locales', () => {
  it('offers English and Urdu, and nothing else', () => {
    expect([...LOCALES].sort()).toEqual(['en', 'ur']);
  });

  it('writes Urdu right to left and English left to right', () => {
    expect(directionOf('ur')).toBe('rtl');
    expect(directionOf('en')).toBe('ltr');
  });

  it('recognises only the languages it supports', () => {
    expect(isLocale('ur')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it('keeps Latin digits for Urdu so figures match the prices and order numbers beside them', () => {
    expect(INTL_TAGS.ur).toContain('-u-nu-latn');
    expect(new Date(2026, 1, 3).toLocaleDateString(INTL_TAGS.ur, { day: 'numeric' })).toBe('3');
  });
});

describe('translate', () => {
  it('returns English by default and Urdu on request', () => {
    expect(translate('en', 'common.close')).toBe('Close');

    const urdu = translate('ur', 'common.close');
    expect(urdu).not.toBe('Close');
    expect(urdu).toMatch(ARABIC_SCRIPT);
  });

  it('fills {placeholders}', () => {
    expect(translate('en', 'common.page', { page: 2, pages: 5 })).toBe('Page 2 of 5');
    expect(translate('ur', 'common.page', { page: 2, pages: 5 })).toMatch(/2.*5|5.*2/);
  });

  it('leaves a placeholder alone when no value was given, rather than printing "undefined"', () => {
    expect(translate('en', 'common.page', { page: 2 })).toBe('Page 2 of {pages}');
  });

  it('picks the plural form from the count', () => {
    expect(translate('en', 'common.itemCount', { count: 1 })).toBe('1 item');
    expect(translate('en', 'common.itemCount', { count: 3 })).toBe('3 items');
    expect(translate('en', 'common.itemCount', { count: 0 })).toBe('0 items');

    // Urdu has its own one/other pair, chosen by the same rule.
    expect(translate('ur', 'common.itemCount', { count: 1 })).toMatch(ARABIC_SCRIPT);
    expect(translate('ur', 'common.itemCount', { count: 1 })).not.toBe(
      translate('ur', 'common.itemCount', { count: 3 }),
    );
  });

  describe('when an Urdu string is missing', () => {
    it('falls back to the English one rather than showing a blank or a key', () => {
      const urdu = dictionaries.ur.common as Record<string, unknown>;
      const original = urdu.close;
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        delete urdu.close;

        expect(translate('ur', 'common.close')).toBe('Close');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('common.close'));
      } finally {
        urdu.close = original;
      }
    });
  });

  it('shows the key itself in development when a dynamic key matches nothing, so it is noticed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(translate('en', 'no.such.key' as TranslationKey)).toBe('no.such.key');
    expect(warn).toHaveBeenCalled();
  });
});

describe('translateIfKnown and translateMessage', () => {
  it('reports "not a key" instead of inventing text', () => {
    expect(translateIfKnown('ur', 'errors.CART_EMPTY')).toMatch(ARABIC_SCRIPT);
    expect(translateIfKnown('ur', 'errors.NOT_A_REAL_CODE')).toBeUndefined();
  });

  it('translates a message that is a key, and returns any other text untouched', () => {
    expect(translateMessage('ur', 'validation.nameRequired')).toMatch(ARABIC_SCRIPT);
    expect(translateMessage('ur', 'Some sentence the server wrote')).toBe(
      'Some sentence the server wrote',
    );
  });

  it('hands back a template with its placeholders intact, in the right plural form', () => {
    expect(translateTemplate('en', 'common.itemCount', 1)).toBe('1 item');
    expect(translateTemplate('en', 'common.itemCount', 4)).toBe('{count} items');
  });
});

describe('bidi isolation', () => {
  it('wraps a number in a left-to-right isolate inside Urdu text', () => {
    const isolated = isolateLtr('ur', '0300 1234567');

    expect(isolated).toBe('⁦' + '0300 1234567' + '⁩');
  });

  it('adds nothing in English, so English output is unchanged', () => {
    expect(isolateLtr('en', '0300 1234567')).toBe('0300 1234567');
  });

  it('follows the active language for code outside React', () => {
    expect(ltrNow('FC-2026-0001')).toBe('FC-2026-0001');

    setActiveLocale('ur');
    expect(ltrNow('FC-2026-0001')).toBe('⁦FC-2026-0001⁩');
  });
});

describe('tNow', () => {
  it('translates in whichever language is active right now', () => {
    expect(tNow('common.close')).toBe('Close');

    setActiveLocale('ur');
    expect(tNow('common.close')).toBe(translate('ur', 'common.close'));
  });
});

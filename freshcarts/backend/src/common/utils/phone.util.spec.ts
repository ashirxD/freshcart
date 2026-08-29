import { isValidPkPhone, normalisePkPhone } from './phone.util';

describe('phone.util', () => {
  describe('normalisePkPhone', () => {
    it.each([
      ['03001234567', '+923001234567'],
      ['+923001234567', '+923001234567'],
      ['923001234567', '+923001234567'],
      ['00923001234567', '+923001234567'],
      ['0300 123 4567', '+923001234567'],
      ['(0300) 123-4567', '+923001234567'],
    ])('normalises %s to %s', (input, expected) => {
      expect(normalisePkPhone(input)).toBe(expected);
    });

    it('leaves an unrecognised shape untouched so validation can reject it', () => {
      expect(normalisePkPhone('12345')).toBe('12345');
    });
  });

  describe('isValidPkPhone', () => {
    it('accepts every supported input shape', () => {
      expect(isValidPkPhone('03001234567')).toBe(true);
      expect(isValidPkPhone('+923451234567')).toBe(true);
    });

    it('rejects landlines, wrong lengths and non-PK numbers', () => {
      expect(isValidPkPhone('0421234567')).toBe(false);
      expect(isValidPkPhone('0300123456')).toBe(false);
      expect(isValidPkPhone('+13001234567')).toBe(false);
      expect(isValidPkPhone('')).toBe(false);
    });
  });
});

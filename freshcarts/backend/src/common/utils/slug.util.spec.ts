import { SLUG_PATTERN, slugify, uniqueSlug } from './slug.util';

describe('slugify', () => {
  it('lowercases and hyphenates a product name', () => {
    expect(slugify('Fauji Chakki Atta 10kg')).toBe('fauji-chakki-atta-10kg');
  });

  it('elides apostrophes instead of turning them into separators', () => {
    // `olper-s-full-cream-milk` would be a poor URL and a poor search key.
    expect(slugify("Olper's Full Cream Milk")).toBe('olpers-full-cream-milk');
  });

  it('strips accents rather than dropping the letter', () => {
    expect(slugify('Nescafé Classic')).toBe('nescafe-classic');
  });

  it('collapses punctuation runs and trims stray hyphens', () => {
    expect(slugify('  Head & Shoulders -- Anti Dandruff!  ')).toBe('head-shoulders-anti-dandruff');
  });

  it('returns an empty string when there is nothing sluggable', () => {
    expect(slugify('!!!')).toBe('');
  });

  it('always produces a value matching the slug pattern', () => {
    for (const input of ["Lay's Masala Chips", 'Rice 5 kg', 'Café — Latte']) {
      expect(SLUG_PATTERN.test(slugify(input))).toBe(true);
    }
  });
});

describe('uniqueSlug', () => {
  it('uses the base slug when it is free', async () => {
    const exists = jest.fn().mockResolvedValue(false);
    await expect(uniqueSlug('Fresh Milk', exists)).resolves.toBe('fresh-milk');
  });

  it('appends the first free numeric suffix on collision', async () => {
    const taken = new Set(['fresh-milk', 'fresh-milk-2']);
    const exists = jest.fn((candidate: string) => Promise.resolve(taken.has(candidate)));

    await expect(uniqueSlug('Fresh Milk', exists)).resolves.toBe('fresh-milk-3');
  });

  it('refuses input that cannot produce a slug', async () => {
    await expect(uniqueSlug('***', jest.fn())).rejects.toThrow(/empty value/);
  });
});

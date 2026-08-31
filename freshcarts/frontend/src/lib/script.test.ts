import { describe, expect, it } from 'vitest';
import { containsUrdu, textDirection } from './script';

/**
 * §50: an Urdu grocery list has to remain readable.
 *
 * The design system already styles `:lang(ur)`; this is what decides which
 * elements get that attribute, so it is the thing that has to be right.
 */

describe('containsUrdu', () => {
  it.each(['دودھ', '۲ دودھ', 'ڈبل روٹی', '2 doodh دودھ'])('recognises %s', (text) => {
    expect(containsUrdu(text)).toBe(true);
  });

  it.each(['2 doodh', 'milk', '', '123'])('leaves %s alone', (text) => {
    expect(containsUrdu(text)).toBe(false);
  });
});

describe('textDirection', () => {
  it('marks pure Urdu as right-to-left', () => {
    expect(textDirection('۲ دودھ')).toEqual({ lang: 'ur', dir: 'rtl' });
  });

  it('lets the browser decide the base direction for mixed text', () => {
    // A rule imposed from outside would get one of the two orders wrong; `auto`
    // uses the writer's own first strong character, which is their intent.
    expect(textDirection('2 doodh دودھ')).toEqual({ lang: 'ur', dir: 'auto' });
  });

  it('leaves Latin text as left-to-right with no language override', () => {
    // Roman Urdu is written in Latin script: it must NOT get the Nastaliq face.
    expect(textDirection('2 doodh')).toEqual({ dir: 'ltr' });
  });
});

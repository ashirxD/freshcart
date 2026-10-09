import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleSync } from '@/providers/locale-sync';
import { signIn, testCustomer } from '@/test/render';
import { LocaleProvider, useI18n, useLocale, type Locale } from '.';
import { LOCALE_COOKIE } from './config';
import { readLocaleCookie, writeLocaleCookie } from './cookie';
import { translate } from './translate';

const URDU_CLOSE = translate('ur', 'common.close');

function clearCookie() {
  document.cookie = LOCALE_COOKIE + '=; Max-Age=0; Path=/';
}

beforeEach(() => {
  clearCookie();
});

afterEach(() => {
  clearCookie();
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
});

/** A screen with something that must survive a language switch. */
function Probe() {
  const { t, tx, ltr, locale, dir } = useI18n();
  const { setLocale } = useLocale();
  const [draft, setDraft] = useState('');
  const [taps, setTaps] = useState(0);

  return (
    <div>
      <p data-testid="state">{locale + '/' + dir}</p>
      <p data-testid="word">{t('common.close')}</p>
      <p data-testid="rich">{tx('ocr.sheet.wrote', { text: <b>doodh</b> })}</p>
      <p data-testid="phone">{ltr('0300 1234567')}</p>

      <input aria-label="draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button type="button" onClick={() => setTaps((count) => count + 1)}>
        {'taps:' + taps}
      </button>

      <button type="button" onClick={() => setLocale('ur')}>
        to-urdu
      </button>
      <button type="button" onClick={() => setLocale('en')}>
        to-english
      </button>
      <button type="button" onClick={() => setLocale('fr' as Locale)}>
        to-french
      </button>
    </div>
  );
}

function renderProbe(initial: Locale = 'en') {
  return render(
    <LocaleProvider initialLocale={initial}>
      <Probe />
    </LocaleProvider>,
  );
}

describe('LocaleProvider', () => {
  it('speaks English with no provider at all', () => {
    render(<Probe />);

    expect(screen.getByTestId('word')).toHaveTextContent('Close');
    expect(screen.getByTestId('state')).toHaveTextContent('en/ltr');
  });

  it('starts in the language the server rendered', () => {
    renderProbe('ur');

    expect(screen.getByTestId('word')).toHaveTextContent(URDU_CLOSE);
    expect(screen.getByTestId('state')).toHaveTextContent('ur/rtl');
  });

  it('writes lang and dir on <html> to match', () => {
    renderProbe('ur');

    expect(document.documentElement.lang).toBe('ur');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('switches the words, lang and dir in place', async () => {
    const user = userEvent.setup();
    renderProbe('en');

    await user.click(screen.getByRole('button', { name: 'to-urdu' }));

    expect(screen.getByTestId('word')).toHaveTextContent(URDU_CLOSE);
    expect(document.documentElement.lang).toBe('ur');
    expect(document.documentElement.dir).toBe('rtl');

    await user.click(screen.getByRole('button', { name: 'to-english' }));

    expect(screen.getByTestId('word')).toHaveTextContent('Close');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('loses nothing on the screen when the language changes', async () => {
    // A reload would empty the cart and this half-typed address. A re-render in
    // place must not: the same elements stay mounted and keep their state.
    const user = userEvent.setup();
    renderProbe('en');

    await user.type(screen.getByLabelText('draft'), '12 Canal Road');
    await user.click(screen.getByRole('button', { name: /taps:/ }));
    await user.click(screen.getByRole('button', { name: /taps:/ }));

    const input = screen.getByLabelText('draft');
    await user.click(screen.getByRole('button', { name: 'to-urdu' }));

    expect(screen.getByLabelText('draft')).toBe(input);
    expect(input).toHaveValue('12 Canal Road');
    expect(screen.getByRole('button', { name: 'taps:2' })).toBeInTheDocument();
  });

  it('remembers the choice in a cookie the server can read', async () => {
    const user = userEvent.setup();
    renderProbe('en');
    expect(readLocaleCookie()).toBeNull();

    await user.click(screen.getByRole('button', { name: 'to-urdu' }));

    expect(readLocaleCookie()).toBe('ur');
    expect(document.cookie).toContain(LOCALE_COOKIE + '=ur');
  });

  it('ignores a language it does not support', async () => {
    const user = userEvent.setup();
    renderProbe('en');

    await user.click(screen.getByRole('button', { name: 'to-french' }));

    expect(screen.getByTestId('state')).toHaveTextContent('en/ltr');
    expect(readLocaleCookie()).toBeNull();
  });

  it('puts React nodes into a translated sentence', () => {
    renderProbe('ur');

    const rich = screen.getByTestId('rich');
    expect(within(rich).getByText('doodh').tagName).toBe('B');
    // The sentence around the node is Urdu, not English.
    expect(rich.textContent).toMatch(/[؀-ۿ]/);
    expect(rich.textContent).not.toMatch(/You wrote/);
  });

  it('isolates numbers inside Urdu and leaves English alone', async () => {
    const user = userEvent.setup();
    renderProbe('en');
    expect(screen.getByTestId('phone').textContent).toBe('0300 1234567');

    await user.click(screen.getByRole('button', { name: 'to-urdu' }));

    expect(screen.getByTestId('phone').textContent).toBe('⁦0300 1234567⁩');
  });
});

describe('the cookie', () => {
  it('round-trips a supported language and reads nothing else', () => {
    writeLocaleCookie('ur');
    expect(readLocaleCookie()).toBe('ur');

    document.cookie = LOCALE_COOKIE + '=klingon; Path=/';
    expect(readLocaleCookie()).toBeNull();
  });
});

describe('LocaleSync', () => {
  function renderSynced() {
    return render(
      <LocaleProvider initialLocale="en">
        <LocaleSync />
        <Probe />
      </LocaleProvider>,
    );
  }

  it('adopts the saved profile language when this device has not chosen one', () => {
    signIn({ ...testCustomer, preferredLanguage: 'ur' });
    renderSynced();

    expect(screen.getByTestId('state')).toHaveTextContent('ur/rtl');
  });

  it('never overrides a language chosen on this device', () => {
    writeLocaleCookie('en');
    signIn({ ...testCustomer, preferredLanguage: 'ur' });
    renderSynced();

    expect(screen.getByTestId('state')).toHaveTextContent('en/ltr');
  });

  it('leaves a visitor who is not signed in alone', () => {
    renderSynced();

    expect(screen.getByTestId('state')).toHaveTextContent('en/ltr');
  });

  it('keeps English for an account that has English saved', () => {
    signIn({ ...testCustomer, preferredLanguage: 'en' });
    renderSynced();

    expect(screen.getByTestId('state')).toHaveTextContent('en/ltr');
  });

  it('follows the profile when someone signs in after the page has loaded', () => {
    renderSynced();
    expect(screen.getByTestId('state')).toHaveTextContent('en/ltr');

    act(() => signIn({ ...testCustomer, preferredLanguage: 'ur' }));

    expect(screen.getByTestId('state')).toHaveTextContent('ur/rtl');
  });
});

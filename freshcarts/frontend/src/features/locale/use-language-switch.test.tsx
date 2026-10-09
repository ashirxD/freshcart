import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageToggle } from '@/components/common/language-toggle';
import { LOCALE_COOKIE } from '@/i18n/config';
import { readLocaleCookie } from '@/i18n/cookie';
import { LocaleProvider } from '@/i18n';
import { signIn, testCustomer } from '@/test/render';
import { useAuthStore } from '@/store/auth.store';

/**
 * THE LANGUAGE TOGGLE, END TO END
 *
 * A guest's choice lives on the device; a signed-in user's is also saved to
 * their profile so it follows them to another phone — and that save must never
 * be able to undo a switch the screen has already made.
 */

function stubProfileSave(outcome: 'ok' | 'fail') {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });

      if (outcome === 'fail') return Promise.reject(new TypeError('offline'));

      return Promise.resolve(
        new Response(JSON.stringify({ ...testCustomer, preferredLanguage: 'ur' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );

  return calls;
}

function renderToggle() {
  return render(
    <LocaleProvider initialLocale="en">
      <LanguageToggle />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  document.cookie = LOCALE_COOKIE + '=; Max-Age=0; Path=/';
});

afterEach(() => {
  document.cookie = LOCALE_COOKIE + '=; Max-Age=0; Path=/';
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
});

describe('LanguageToggle', () => {
  it('shows both languages, each in its own name, with the current one marked', () => {
    renderToggle();

    const english = screen.getByRole('button', { name: 'English' });
    const urdu = screen.getByRole('button', { name: 'اردو' });

    expect(english).toHaveAttribute('aria-pressed', 'true');
    expect(urdu).toHaveAttribute('aria-pressed', 'false');
    // Tagged with its own language so a screen reader pronounces it properly.
    expect(urdu).toHaveAttribute('lang', 'ur');
    expect(english).toHaveAttribute('lang', 'en');
  });

  it('switches the page to Urdu right to left, and remembers it', async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole('button', { name: 'اردو' }));

    expect(screen.getByRole('button', { name: 'اردو' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.lang).toBe('ur');
    expect(document.documentElement.dir).toBe('rtl');
    expect(readLocaleCookie()).toBe('ur');
  });

  it('keeps the two buttons in the same order whichever language is active', async () => {
    // The group is pinned left-to-right so the one under a thumb never swaps.
    const user = userEvent.setup();
    renderToggle();

    const order = () =>
      screen
        .getAllByRole('button')
        .map((button) => button.getAttribute('lang'))
        .join();

    expect(order()).toBe('en,ur');
    await user.click(screen.getByRole('button', { name: 'اردو' }));
    expect(order()).toBe('en,ur');
    expect(screen.getByRole('group')).toHaveAttribute('dir', 'ltr');
  });

  describe('for a guest', () => {
    it('saves nothing to any profile', async () => {
      const calls = stubProfileSave('ok');
      const user = userEvent.setup();
      renderToggle();

      await user.click(screen.getByRole('button', { name: 'اردو' }));

      expect(calls).toHaveLength(0);
    });
  });

  describe('for a signed-in customer', () => {
    beforeEach(() => signIn(testCustomer));

    it('also saves the choice to their profile', async () => {
      const calls = stubProfileSave('ok');
      const user = userEvent.setup();
      renderToggle();

      await user.click(screen.getByRole('button', { name: 'اردو' }));

      await waitFor(() => expect(calls).toHaveLength(1));
      expect(calls[0]).toMatchObject({
        method: 'PATCH',
        body: { preferredLanguage: 'ur' },
      });
      expect(calls[0].url).toContain('/users/me');
      expect(useAuthStore.getState().user?.preferredLanguage).toBe('ur');
    });

    it('still switches when saving to the profile fails', async () => {
      const calls = stubProfileSave('fail');
      const user = userEvent.setup();
      renderToggle();

      await user.click(screen.getByRole('button', { name: 'اردو' }));

      await waitFor(() => expect(calls).toHaveLength(1));
      // The failure is silent and the screen is not rolled back.
      expect(screen.getByRole('button', { name: 'اردو' })).toHaveAttribute('aria-pressed', 'true');
      expect(document.documentElement.dir).toBe('rtl');
      expect(readLocaleCookie()).toBe('ur');
    });

    it('does not call the API when the language has not changed', async () => {
      const calls = stubProfileSave('ok');
      const user = userEvent.setup();
      renderToggle();

      await user.click(screen.getByRole('button', { name: 'English' }));

      expect(calls).toHaveLength(0);
    });
  });
});

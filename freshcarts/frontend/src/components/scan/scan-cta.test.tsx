import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, signIn, signOut } from '@/test/render';
import { ScanCta } from './scan-cta';

/**
 * §37: when the AI service is down, only scanning degrades.
 *
 * The entry point is what enforces that promise for a shopper — it removes
 * itself rather than leading them into a feature that cannot work.
 */

function stubAvailability(available: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ available }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
}

describe('ScanCta', () => {
  beforeEach(() => signIn());

  it('invites the shopper in when scanning works', async () => {
    stubAvailability(true);
    renderWithProviders(<ScanCta />);

    const link = await screen.findByRole('link', { name: /scan grocery list/i });
    expect(link).toHaveAttribute('href', '/scan');
  });

  it('says what the feature does in the shopper’s terms', async () => {
    // §79: "take a picture and we'll do the boring work", not "upload an image
    // to our OCR pipeline".
    stubAvailability(true);
    renderWithProviders(<ScanCta />);

    expect(await screen.findByText(/do the boring work/i)).toBeInTheDocument();
  });

  it('hides itself when the AI service is unavailable', async () => {
    stubAvailability(false);
    renderWithProviders(<ScanCta />);

    await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument());
  });

  it('shows nothing while the answer is still unknown', () => {
    // Never appears and then vanishes under a thumb.
    stubAvailability(true);
    renderWithProviders(<ScanCta />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('asks nothing of the server for a signed-out visitor', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    signOut();

    renderWithProviders(<ScanCta />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

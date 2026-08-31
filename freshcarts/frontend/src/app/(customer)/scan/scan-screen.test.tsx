import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeMatchedItem, makeScanCandidate, makeScanResult } from '@/test/fixtures';
import { QueryClient } from '@tanstack/react-query';
import { renderWithProviders, signIn, signOut } from '@/test/render';
import type { ScanConfirmation, ScanResult } from '@/types/scan';
import { ScanScreen } from './scan-screen';

/**
 * The scanner, driven the way a shopper drives it (§66).
 *
 * Every test walks the real flow — choose a photo, look at it, submit, review,
 * add — rather than rendering an inner component with the interesting state
 * handed to it. That is what makes these tests catch the bugs that matter: a
 * stage that never advances, a button that stays disabled, an ambiguous line
 * that silently pre-selects a product nobody chose.
 */

/** A minimal but genuine PNG, so the picker's type and size checks run for real. */
function pngFile(name = 'list.png', bytes = 2_000): File {
  const header = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const data = new Uint8Array(bytes);
  data.set(header);

  return new File([data], name, { type: 'image/png' });
}

interface Routes {
  scan?: () => Response | Promise<Response>;
  confirm?: () => Response | Promise<Response>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubApi(routes: Routes = {}) {
  const calls: Array<{ url: string; body: unknown }> = [];

  const fetchMock = vi.fn(async (url: string, options: RequestInit = {}) => {
    const body =
      typeof options.body === 'string'
        ? (JSON.parse(options.body) as unknown)
        : (options.body ?? null);

    calls.push({ url, body });

    if (url.includes('/ocr/grocery-list/confirm')) {
      return routes.confirm
        ? routes.confirm()
        : json({ added: [], failed: [], cart: { itemCount: 0, totalQuantity: 0 } });
    }

    if (url.includes('/ocr/grocery-list')) {
      return routes.scan ? routes.scan() : json(makeScanResult());
    }

    if (url.includes('/ocr/availability')) return json({ available: true });

    return json({});
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}

/** Chooses a photo and submits it, leaving the screen on the review step. */
async function scanAList(user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByLabelText(/upload an image/i);
  await user.upload(input, pngFile());

  await user.click(await screen.findByRole('button', { name: /read my list/i }));
}

describe('ScanScreen', () => {
  beforeEach(() => signIn());

  describe('choosing a photo', () => {
    it('offers both a camera and an upload route', () => {
      stubApi();
      renderWithProviders(<ScanScreen />);

      expect(screen.getByRole('button', { name: /take photo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upload image/i })).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /turn your grocery list into a cart/i }),
      ).toBeInTheDocument();
    });

    it('shows a preview with retake, remove and continue before uploading', async () => {
      // §46 and §68: nothing is sent until the shopper has seen the photo, so a
      // blurry one costs neither their data nor our OCR time.
      const user = userEvent.setup();
      const { fetchMock } = stubApi();
      renderWithProviders(<ScanScreen />);

      await user.upload(screen.getByLabelText(/upload an image/i), pngFile());

      expect(
        await screen.findByRole('heading', { name: /does this look right/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retake/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /read my list/i })).toBeInTheDocument();

      // Only the availability probe has run; the photo has not been uploaded.
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('grocery-list'))).toBe(
        false,
      );
    });

    it('returns to the start when the photo is removed', async () => {
      const user = userEvent.setup();
      stubApi();
      renderWithProviders(<ScanScreen />);

      await user.upload(screen.getByLabelText(/upload an image/i), pngFile());
      await user.click(await screen.findByRole('button', { name: /remove/i }));

      expect(
        await screen.findByRole('heading', { name: /turn your grocery list into a cart/i }),
      ).toBeInTheDocument();
    });

    it('offers the file picker only image types', () => {
      stubApi();
      renderWithProviders(<ScanScreen />);

      expect(screen.getByLabelText(/upload an image/i)).toHaveAttribute(
        'accept',
        'image/jpeg,image/png,image/webp',
      );
    });

    it('refuses a dropped file that is not an image, without contacting the server', async () => {
      // Drag-and-drop bypasses the `accept` attribute entirely, so this is the
      // path a non-image can actually arrive by - and the guard has to hold.
      const { fetchMock } = stubApi();
      renderWithProviders(<ScanScreen />);

      const notAnImage = new File(['#!/bin/sh'], 'script.sh', { type: 'text/x-shellscript' });
      const dropZone = screen.getByRole('button', { name: /take photo/i }).parentElement;

      fireEvent.drop(dropZone as HTMLElement, { dataTransfer: { files: [notAnImage] } });

      expect(await screen.findByRole('alert')).toHaveTextContent(/please choose a photo/i);
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('grocery-list'))).toBe(
        false,
      );
    });

    it('refuses an oversized photo before uploading it', async () => {
      const user = userEvent.setup();
      stubApi();
      renderWithProviders(<ScanScreen />);

      await user.upload(screen.getByLabelText(/upload an image/i), pngFile('huge.png', 9_000_000));

      expect(await screen.findByText(/larger than 8 mb/i)).toBeInTheDocument();
    });
  });

  describe('processing', () => {
    it('tells the shopper what is happening, in their language not ours', async () => {
      // §45: never "Calling FastAPI" or "Running OCR model".
      const user = userEvent.setup();
      let release: (value: Response) => void = () => {};
      stubApi({ scan: () => new Promise<Response>((resolve) => (release = resolve)) });

      renderWithProviders(<ScanScreen />);
      await scanAList(user);

      expect(await screen.findByText(/reading your list/i)).toBeInTheDocument();
      expect(screen.queryByText(/fastapi|ocr|tesseract|mongo/i)).not.toBeInTheDocument();

      release(json(makeScanResult()));
      await screen.findByRole('heading', { name: /we found your groceries/i });
    });
  });

  describe('the review screen', () => {
    it('shows what was read and what it was matched to', async () => {
      // §10: the shopper's own words stay on screen next to the product, which
      // is what makes a wrong match explainable.
      const user = userEvent.setup();
      stubApi();
      renderWithProviders(<ScanScreen />);
      await scanAList(user);

      expect(
        await screen.findByRole('heading', { name: /we found your groceries/i }),
      ).toBeInTheDocument();
      expect(screen.getByText('2 doodh')).toBeInTheDocument();
      expect(screen.getByText('Olper’s Full Cream Milk')).toBeInTheDocument();
    });

    it('summarises what is ready and what needs help', async () => {
      // §31: "We read 3 items. 1 is ready to add, and 2 need your help."
      const user = userEvent.setup();
      stubApi();
      renderWithProviders(<ScanScreen />);
      await scanAList(user);

      const summary = await screen.findByText(/we read/i);
      expect(summary).toHaveTextContent('3');
      expect(summary).toHaveTextContent(/ready to add/i);
      expect(summary).toHaveTextContent(/need your help/i);
    });

    it('leaves an ambiguous line unselected and asks for a choice', async () => {
      // §27: auto-selecting the leader is how a shopper buys the wrong thing.
      const user = userEvent.setup();
      stubApi();
      renderWithProviders(<ScanScreen />);
      await scanAList(user);

      await screen.findByRole('heading', { name: /we found your groceries/i });

      expect(screen.getByText(/we’re not sure which product you mean/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /choose a product/i })).toBeInTheDocument();
      // Neither detergent is presented as decided.
      expect(screen.queryByText('Surf Excel Washing Powder')).not.toBeInTheDocument();
    });

    it('lets the shopper pick an alternative, and counts it as ready', async () => {
      const user = userEvent.setup();
      stubApi();
      renderWithProviders(<ScanScreen />);
      await scanAList(user);

      await user.click(await screen.findByRole('button', { name: /choose a product/i }));

      const dialog = await screen.findByRole('dialog', { name: /which one did you mean/i });
      await user.click(within(dialog).getByRole('radio', { name: /surf excel/i }));

      expect(await screen.findByText('Surf Excel Washing Powder')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add 2 items to cart/i })).toBeEnabled();
    });

    it('offers a way out for an item that was not found', async () => {
      // §28: one unknown item must not block the list, and must not be a dead end.
      const user = userEvent.setup();
      stubApi();
      renderWithProviders(<ScanScreen />);
      await scanAList(user);

      await screen.findByRole('heading', { name: /we found your groceries/i });

      expect(screen.getByText(/we couldn’t find this item/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /search for it yourself/i })).toHaveAttribute(
        'href',
        '/search?q=zafraan',
      );
    });

    it('lets a quantity be changed', async () => {
      const user = userEvent.setup();
      stubApi({ scan: () => json(makeScanResult({ items: [makeMatchedItem()] })) });
      renderWithProviders(<ScanScreen />);
      await scanAList(user);

      await screen.findByRole('heading', { name: /we found your groceries/i });
      await user.click(screen.getByRole('button', { name: /increase quantity of olper/i }));

      expect(await screen.findByText('Rs. 1,020')).toBeInTheDocument();
    });

    it('lets an item be removed and put back', async () => {
      const user = userEvent.setup();
      stubApi({ scan: () => json(makeScanResult({ items: [makeMatchedItem()] })) });
      renderWithProviders(<ScanScreen />);
      await scanAList(user);

      await screen.findByRole('heading', { name: /we found your groceries/i });
      await user.click(screen.getByRole('button', { name: /^remove$/i }));

      expect(await screen.findByText(/removed/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /nothing ready to add/i })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: /undo/i }));
      expect(await screen.findByRole('button', { name: /add 1 item to cart/i })).toBeEnabled();
    });

    it('caps the quantity at what is in stock and says so', async () => {
      // §33: OCR must not bypass inventory, and the shopper is told the number
      // so they can change it rather than only being refused.
      const user = userEvent.setup();
      stubApi({
        scan: () =>
          json(
            makeScanResult({
              items: [
                makeMatchedItem({
                  source: { ...makeMatchedItem().source, rawText: '10 anday', quantity: 10 },
                  match: {
                    status: 'MATCHED',
                    confidence: 'HIGH',
                    product: makeScanCandidate({ name: 'Desi Anday', availableQuantity: 4 }),
                  },
                }),
              ],
            }),
          ),
      });

      renderWithProviders(<ScanScreen />);
      await scanAList(user);

      expect(await screen.findByText(/only 4 are available/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add 1 item to cart/i })).toBeInTheDocument();
    });

    it('shows an out-of-stock match without offering to add it', async () => {
      const user = userEvent.setup();
      stubApi({
        scan: () =>
          json(
            makeScanResult({
              items: [
                makeMatchedItem({
                  match: {
                    status: 'MATCHED',
                    confidence: 'HIGH',
                    product: makeScanCandidate({ availableQuantity: 0, isAvailable: false }),
                  },
                }),
              ],
            }),
          ),
      });

      renderWithProviders(<ScanScreen />);
      await scanAList(user);

      expect(await screen.findAllByText(/out of stock/i)).not.toHaveLength(0);
      expect(screen.getByRole('button', { name: /nothing ready to add/i })).toBeDisabled();
    });
  });

  describe('adding to the cart', () => {
    it('sends only product ids and quantities', async () => {
      // §61 and §67: no price, no name, no confidence. The server re-reads
      // everything, and there is no field here that could influence a charge.
      const user = userEvent.setup();
      const { calls } = stubApi({
        scan: () => json(makeScanResult({ items: [makeMatchedItem()] })),
        confirm: () =>
          json({
            added: [
              { productId: 'p-milk-olpers', productName: 'Olper’s Full Cream Milk', quantity: 2 },
            ],
            failed: [],
            cart: { itemCount: 1, totalQuantity: 2 },
          }),
      });

      renderWithProviders(<ScanScreen />);
      await scanAList(user);
      await user.click(await screen.findByRole('button', { name: /add 1 item to cart/i }));

      await screen.findByRole('heading', { name: /added to your cart/i });

      const confirmCall = calls.find((call) => call.url.includes('/confirm'));
      expect(confirmCall?.body).toEqual({
        items: [{ productId: 'p-milk-olpers', quantity: 2 }],
      });

      // The guarantee is structural: every line carries exactly two fields,
      // so there is no price, name or confidence for a client to influence.
      const items = (confirmCall?.body as { items: Array<Record<string, unknown>> }).items;
      for (const line of items) {
        expect(Object.keys(line).sort()).toEqual(['productId', 'quantity']);
      }
    });

    it('reports partial success rather than hiding what failed', async () => {
      // §31 and §62: both lists, plainly.
      const user = userEvent.setup();
      stubApi({
        confirm: () =>
          json({
            added: [
              { productId: 'p-milk-olpers', productName: 'Olper’s Full Cream Milk', quantity: 2 },
            ],
            failed: [
              {
                productId: 'p-eggs',
                productName: 'Desi Anday',
                requestedQuantity: 10,
                reason: 'Only 4 are available',
                availableQuantity: 4,
              },
            ],
            cart: { itemCount: 1, totalQuantity: 2 },
          }),
      });

      renderWithProviders(<ScanScreen />);
      await scanAList(user);
      await user.click(await screen.findByRole('button', { name: /add 1 item to cart/i }));

      expect(
        await screen.findByRole('heading', { name: /added to your cart/i }),
      ).toBeInTheDocument();
      expect(screen.getByText('Could not be added')).toBeInTheDocument();
      expect(screen.getByText('Only 4 are available')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /go to cart/i })).toBeInTheDocument();
    });

    it('leaves the unresolved items to come back to', async () => {
      // §31: "Add 5 items to cart. Then let the customer resolve the rest."
      const user = userEvent.setup();
      stubApi({
        confirm: () =>
          json({
            added: [
              { productId: 'p-milk-olpers', productName: 'Olper’s Full Cream Milk', quantity: 2 },
            ],
            failed: [],
            cart: { itemCount: 1, totalQuantity: 2 },
          }),
      });

      renderWithProviders(<ScanScreen />);
      await scanAList(user);
      await user.click(await screen.findByRole('button', { name: /add 1 item to cart/i }));

      const back = await screen.findByRole('button', { name: /sort out the remaining 2 items/i });
      await user.click(back);

      // The two that still need a decision are back, and the finished line
      // reads as finished rather than as something the shopper removed.
      expect(await screen.findByText('surf 1')).toBeInTheDocument();
      expect(screen.getByText(/^Added/).closest('li')).toHaveTextContent('Full Cream Milk');
      expect(screen.getByRole('button', { name: /nothing ready to add/i })).toBeDisabled();
    });

    it('updates the cart cache from the response, with no second request', async () => {
      // §63: the badge is right immediately, and there is no second source of
      // cart state.
      const user = userEvent.setup();
      const cart = {
        id: 'c1',
        items: [],
        itemCount: 1,
        totalQuantity: 2,
        subtotal: 680,
        hasIssues: false,
        updatedAt: null,
      };

      const { calls } = stubApi({
        confirm: () => json({ added: [], failed: [], cart } as unknown as ScanConfirmation),
      });

      // A client that keeps unobserved entries: the shared test client uses
      // gcTime 0, which evicts this write immediately because nothing on the
      // scan screen observes the cart query.
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Infinity, staleTime: 0 },
          mutations: { retry: false },
        },
      });

      renderWithProviders(<ScanScreen />, { queryClient });
      await scanAList(user);
      await user.click(await screen.findByRole('button', { name: /add 1 item to cart/i }));

      await waitFor(() => expect(queryClient.getQueryData(['cart', 'detail'])).toEqual(cart));
      expect(calls.filter((call) => call.url.endsWith('/cart')).length).toBe(0);
    });
  });

  describe('when things go wrong', () => {
    it('explains an unreadable photo and offers a retry', async () => {
      // §59: the photo is the problem, said plainly.
      const user = userEvent.setup();
      stubApi({
        scan: () =>
          json(
            { code: 'IMAGE_UNREADABLE', message: 'The writing on that photo is hard to read.' },
            422,
          ),
      });

      renderWithProviders(<ScanScreen />);
      await scanAList(user);

      expect(
        await screen.findByRole('heading', { name: /difficult to read/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/clearer photo in good light/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /try another photo/i }));
      expect(
        await screen.findByRole('heading', { name: /turn your grocery list into a cart/i }),
      ).toBeInTheDocument();
    });

    it('says scanning is unavailable without naming what broke', async () => {
      // §36: no TimeoutError, no service name, no stack trace.
      const user = userEvent.setup();
      stubApi({ scan: () => json({ code: 'SCAN_UNAVAILABLE', message: 'x' }, 503) });

      renderWithProviders(<ScanScreen />);
      await scanAList(user);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/could not read your list right now/i);
      expect(alert).toHaveTextContent(/everything else still works/i);
      expect(alert.textContent).not.toMatch(/timeout|fastapi|503|python|ECONN/i);
    });

    it('reports an empty result as a different outcome from a failure', async () => {
      // §58: the photo was fine; there were just no groceries on it.
      const user = userEvent.setup();
      stubApi({ scan: () => json(makeScanResult({ items: [] })) });

      renderWithProviders(<ScanScreen />);
      await scanAList(user);

      expect(
        await screen.findByRole('heading', { name: /couldn’t find any grocery items/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /browse products/i })).toBeInTheDocument();
    });

    it('handles being offline with advice rather than an error code', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (String(url).includes('availability')) return json({ available: true });
          throw new TypeError('Failed to fetch');
        }),
      );

      renderWithProviders(<ScanScreen />);
      await scanAList(user);

      expect(
        await screen.findByRole('heading', { name: /appear to be offline/i }),
      ).toBeInTheDocument();
    });
  });

  describe('access', () => {
    it('asks a signed-out visitor to sign in rather than failing', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      signOut();

      renderWithProviders(<ScanScreen />);

      expect(await screen.findByText(/sign in to scan your grocery list/i)).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

/** Keeps the fixture type import used, so the contract stays checked here. */
export type _ScanResultContract = ScanResult;

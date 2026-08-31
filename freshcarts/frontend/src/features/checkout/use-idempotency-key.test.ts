import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useIdempotencyKey } from './use-idempotency-key';

describe('useIdempotencyKey', () => {
  it('mints a key lazily, on first use', () => {
    const { result } = renderHook(() => useIdempotencyKey());

    const key = result.current.current();
    expect(key).toBeTruthy();
    expect(key.length).toBeGreaterThanOrEqual(8);
  });

  it('returns the SAME key on every call within one attempt', () => {
    const { result } = renderHook(() => useIdempotencyKey());

    // This is the whole protection: a double-tap, a timeout retry and a
    // reconnect retry all send this one key, and the server answers the later
    // ones with the order the first created.
    const first = result.current.current();
    const second = result.current.current();
    const third = result.current.current();

    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('survives a re-render, so a state change elsewhere cannot mint a new one', () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey());

    const before = result.current.current();
    rerender();
    rerender();

    expect(result.current.current()).toBe(before);
  });

  it('mints a new key after a reset, because that is a genuinely new attempt', () => {
    const { result } = renderHook(() => useIdempotencyKey());

    const first = result.current.current();
    act(() => result.current.reset());
    const second = result.current.current();

    // The shopper fixed something — a line sold out, a price moved — so the
    // retry must not be answered with a replay of the failed attempt.
    expect(second).not.toBe(first);
  });

  it('gives two checkout attempts different keys', () => {
    const first = renderHook(() => useIdempotencyKey());
    const second = renderHook(() => useIdempotencyKey());

    expect(first.result.current.current()).not.toBe(second.result.current.current());
  });

  it('produces a key the API will accept', () => {
    const { result } = renderHook(() => useIdempotencyKey());

    // Mirrors IDEMPOTENCY_KEY_PATTERN on the server: 8-100 of [A-Za-z0-9._:-].
    expect(result.current.current()).toMatch(/^[A-Za-z0-9._:-]{8,100}$/);
  });
});

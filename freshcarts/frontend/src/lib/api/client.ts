import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth.store';
import type { SessionResponse } from '@/types/auth';
import { toApiError, toNetworkError } from './errors';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Set for the refresh call itself, so a failed refresh cannot recurse. */
  skipAuthRefresh?: boolean;
}

/**
 * The single entry point for talking to the FreshCarts API.
 *
 * Responsibilities kept here so no component or hook has to think about them:
 *   - attach the in-memory access token
 *   - send the httpOnly refresh cookie (credentials: 'include')
 *   - transparently refresh once on 401 and replay the original request
 *   - normalise every failure into an ApiError
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);

  if (response.status === 401 && !options.skipAuthRefresh) {
    const refreshed = await refreshSession();

    if (refreshed) {
      const retried = await send(path, options);
      return parse<T>(retried);
    }

    useAuthStore.getState().clearSession();
  }

  return parse<T>(response);
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { body, skipAuthRefresh: _skipAuthRefresh, headers, ...rest } = options;
  const accessToken = useAuthStore.getState().accessToken;

  // A photo is not JSON. FormData is passed through untouched and, crucially,
  // WITHOUT a Content-Type header: the browser sets it including the multipart
  // boundary, and setting it by hand produces a body no server can parse.
  const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData;

  const requestHeaders = new Headers(headers);
  if (body !== undefined && !isMultipart) requestHeaders.set('Content-Type', 'application/json');
  if (accessToken) requestHeaders.set('Authorization', 'Bearer ' + accessToken);

  try {
    return await fetch(env.apiUrl + path, {
      ...rest,
      headers: requestHeaders,
      // Required for the refresh cookie to travel with the request.
      credentials: 'include',
      body: body === undefined ? undefined : isMultipart ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    // A dropped connection rejects rather than returning a status. Normalising
    // it here means every caller handles one error type, and a shopper on a
    // patchy mobile connection sees a sentence instead of "Failed to fetch".
    throw toNetworkError();
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw toApiError(response.status, payload);
  }

  return payload as T;
}

/**
 * Concurrent 401s must trigger exactly one refresh, otherwise token rotation
 * invalidates the session that a parallel request just obtained.
 */
let refreshInFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function performRefresh(): Promise<boolean> {
  try {
    const response = await send('/auth/refresh', { method: 'POST', skipAuthRefresh: true });

    if (!response.ok) return false;

    const session = (await response.json()) as SessionResponse;
    useAuthStore.getState().setSession(session.user, session.accessToken);
    return true;
  } catch {
    return false;
  }
}

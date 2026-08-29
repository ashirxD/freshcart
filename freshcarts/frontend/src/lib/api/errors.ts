/** Normalised error for every failed API call. Mirrors the backend error shape. */
export class ApiError extends Error {
  readonly status: number;
  readonly details: string[];

  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isValidationError(): boolean {
    return this.status === 400 || this.status === 422;
  }
}

interface ApiErrorBody {
  message?: string | string[];
  error?: string;
}

/** Turns the backend error payload into a single user-facing message. */
export function toApiError(status: number, body: unknown): ApiError {
  const payload = (body ?? {}) as ApiErrorBody;
  const messages = Array.isArray(payload.message)
    ? payload.message
    : payload.message
      ? [payload.message]
      : [];

  const message = messages[0] ?? payload.error ?? 'Something went wrong. Please try again.';

  return new ApiError(status, message, messages);
}

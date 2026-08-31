/**
 * Validates everything the AI service sends before any of it is believed.
 *
 * §39 is emphatic and correct: an AI response is untrusted input. It arrives
 * over the network from a separate process in a different language with its own
 * deployment cycle, and a malformed payload that reaches the matcher becomes a
 * malformed item in front of a shopper — or, worse, a quantity of 10,000 in
 * somebody's cart.
 *
 * So this is a parser, not a cast. It checks types, ranges, enum membership and
 * array sizes, and it *drops* individual items it cannot make sense of rather
 * than failing the whole scan: one unreadable line should not lose a shopper
 * the other nine. A response whose overall shape is wrong is rejected outright,
 * because at that point nothing in it can be relied on.
 *
 * Written by hand rather than with a schema library: the backend has no runtime
 * validator for plain objects (class-validator works on DTO classes, and this
 * is not a request body), and one function is a smaller price than a dependency
 * (§75).
 */

import { Logger } from '@nestjs/common';
import {
  AI_LANGUAGES,
  AI_LIMITS,
  AI_SCRIPTS,
  AI_UNITS,
  type AiExtractedItem,
  type AiGroceryListResponse,
  type AiLanguage,
  type AiOcrDiagnostics,
  type AiScript,
  type AiUnit,
  SUPPORTED_CONTRACT_VERSION,
} from './ai-ocr.contract';

const logger = new Logger('AiOcrValidator');

/** Thrown when the payload cannot be trusted at all. */
export class MalformedAiResponseError extends Error {
  constructor(reason: string) {
    super('The AI service returned a response this API cannot use: ' + reason);
    this.name = 'MalformedAiResponseError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, maxLength);
}

/**
 * A confidence is either a real number in 0..1 or absent.
 *
 * `null` survives as `null` on purpose — §11 forbids inventing a number the
 * engine did not report, and coercing it to 0 would make the UI show "0%
 * confident" about a line that was read perfectly well.
 */
function asConfidence(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * Validates one item, returning null when it is unusable.
 *
 * Every field is clamped rather than trusted: a quantity of 10,000 becomes 99,
 * because the alternative is a shopper staring at an order for ten thousand
 * eggs and losing all confidence in the feature.
 */
function validateItem(raw: unknown): AiExtractedItem | null {
  if (!isRecord(raw)) return null;

  const normalizedName = asString(raw.normalizedName, AI_LIMITS.maxNameLength);
  // Without a name there is nothing to search the catalogue for, so the item
  // has no value to anyone downstream.
  if (!normalizedName) return null;

  const rawText = asString(raw.rawText, AI_LIMITS.maxNameLength) ?? normalizedName;

  const quantity =
    typeof raw.quantity === 'number' && Number.isFinite(raw.quantity)
      ? Math.min(AI_LIMITS.maxQuantity, Math.max(1, Math.round(raw.quantity)))
      : 1;

  const unit = asEnum<AiUnit>(raw.unit, AI_UNITS);

  const unitValue =
    typeof raw.unitValue === 'number' &&
    Number.isFinite(raw.unitValue) &&
    raw.unitValue > 0 &&
    raw.unitValue <= AI_LIMITS.maxUnitValue
      ? raw.unitValue
      : null;

  return {
    rawText,
    normalizedName,
    quantity,
    // A size with no unit is meaningless, so the pair is kept consistent.
    unit,
    unitValue: unit ? unitValue : null,
    brand: asString(raw.brand, 80),
    qualifiers: Array.isArray(raw.qualifiers)
      ? raw.qualifiers
          .map((value) => asString(value, 40))
          .filter((value): value is string => value !== null)
          .slice(0, 8)
      : [],
    confidence: asConfidence(raw.confidence),
    recognized: raw.recognized === true,
    quantityAdjusted: raw.quantityAdjusted === true,
    script: asEnum<AiScript>(raw.script, AI_SCRIPTS) ?? 'unknown',
  };
}

function validateDiagnostics(raw: unknown): AiOcrDiagnostics {
  const source = isRecord(raw) ? raw : {};

  const count = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;

  return {
    engineConfidence: asConfidence(source.engineConfidence),
    confidenceBand:
      asEnum(source.confidenceBand, ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'] as const) ?? 'UNKNOWN',
    lineCount: count(source.lineCount),
    skippedLineCount: count(source.skippedLineCount),
    processingMs: count(source.processingMs),
  };
}

/**
 * Turns an unknown payload into a response this API is willing to act on.
 *
 * Throws MalformedAiResponseError when the payload's shape is wrong. The caller
 * translates that into SCAN_FAILED — §39 says malformed AI output is an AI
 * service failure, not something to pass along and hope about.
 */
export function validateOcrResponse(payload: unknown): AiGroceryListResponse {
  if (!isRecord(payload)) {
    throw new MalformedAiResponseError('it was not an object');
  }

  // Version first. A contract this reader does not understand is refused before
  // its fields are interpreted, rather than being half-read under the old rules.
  if (payload.version !== SUPPORTED_CONTRACT_VERSION) {
    throw new MalformedAiResponseError(
      'contract version ' +
        String(payload.version) +
        ' is not supported (expected ' +
        SUPPORTED_CONTRACT_VERSION +
        ')',
    );
  }

  if (!Array.isArray(payload.items)) {
    throw new MalformedAiResponseError('items was not an array');
  }

  const items: AiExtractedItem[] = [];
  let dropped = 0;

  for (const raw of payload.items.slice(0, AI_LIMITS.maxItems)) {
    const item = validateItem(raw);
    if (item) items.push(item);
    else dropped += 1;
  }

  if (dropped > 0) {
    // Worth a log line: a rising count here means the two services have drifted.
    logger.warn('Dropped ' + dropped + ' malformed item(s) from an AI response');
  }

  return {
    version: SUPPORTED_CONTRACT_VERSION,
    requestId: asString(payload.requestId, 100) ?? '',
    language: asEnum<AiLanguage>(payload.language, AI_LANGUAGES) ?? 'unknown',
    rawText:
      typeof payload.rawText === 'string' ? payload.rawText.slice(0, AI_LIMITS.maxTextLength) : '',
    items,
    warnings: Array.isArray(payload.warnings)
      ? payload.warnings
          .map((value) => asString(value, 200))
          .filter((value): value is string => value !== null)
          .slice(0, 10)
      : [],
    diagnostics: validateDiagnostics(payload.diagnostics),
  };
}

/**
 * The NestJS half of the AI service contract (sections 9, 39 and 71).
 *
 * These types mirror the Pydantic models in `ai-service/app/schemas/ocr.py`.
 * They are a *claim* about what the AI service sends, not a guarantee — which
 * is exactly why `validateOcrResponse` exists below and why nothing in this
 * module is allowed to consume a raw response without going through it.
 *
 * Note what the contract cannot express: a product id, a price, a stock level.
 * The AI service has never seen the catalogue, so there is no field here it
 * could use to influence what a shopper is charged (section 0).
 */

/** Bumped by the AI service when a change would break this reader. */
export const SUPPORTED_CONTRACT_VERSION = '1';

/** Units the AI service is permitted to report. Anything else is rejected. */
export const AI_UNITS = [
  'kg',
  'g',
  'liter',
  'ml',
  'dozen',
  'piece',
  'pack',
  'bottle',
  'box',
] as const;

export type AiUnit = (typeof AI_UNITS)[number];

export const AI_SCRIPTS = ['latin', 'urdu', 'mixed', 'unknown'] as const;
export type AiScript = (typeof AI_SCRIPTS)[number];

export const AI_LANGUAGES = ['en', 'ur', 'mixed', 'unknown'] as const;
export type AiLanguage = (typeof AI_LANGUAGES)[number];

/** Hard ceilings applied to whatever the AI service sends (section 39). */
export const AI_LIMITS = {
  maxItems: 60,
  maxTextLength: 20_000,
  maxNameLength: 200,
  maxQuantity: 99,
  maxUnitValue: 100_000,
} as const;

export interface AiExtractedItem {
  /** Exactly what was on the line, as the engine read it. */
  rawText: string;
  /** Canonical English name to search the catalogue by. */
  normalizedName: string;
  /** How many products the shopper asked for. */
  quantity: number;
  unit: AiUnit | null;
  /** The pack size asked for, in `unit`. Distinct from `quantity`. */
  unitValue: number | null;
  brand: string | null;
  qualifiers: string[];
  /** Confidence in READING THE LINE. Never a product-match confidence. */
  confidence: number | null;
  /** Whether the AI vocabulary knew the word, or is passing it through. */
  recognized: boolean;
  quantityAdjusted: boolean;
  script: AiScript;
}

export interface AiOcrDiagnostics {
  engineConfidence: number | null;
  confidenceBand: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  lineCount: number;
  skippedLineCount: number;
  processingMs: number;
}

export interface AiGroceryListResponse {
  version: string;
  requestId: string;
  language: AiLanguage;
  rawText: string;
  items: AiExtractedItem[];
  warnings: string[];
  diagnostics: AiOcrDiagnostics;
}

/** The AI service's failure shape, and the codes it can report. */
export interface AiErrorResponse {
  version?: string;
  requestId?: string;
  code?: string;
  message?: string;
}

export const AI_ERROR_CODES = {
  INVALID_IMAGE: 'INVALID_IMAGE',
  IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',
  IMAGE_UNREADABLE: 'IMAGE_UNREADABLE',
  ENGINE_UNAVAILABLE: 'ENGINE_UNAVAILABLE',
  ENGINE_FAILED: 'ENGINE_FAILED',
  ENGINE_TIMEOUT: 'ENGINE_TIMEOUT',
} as const;

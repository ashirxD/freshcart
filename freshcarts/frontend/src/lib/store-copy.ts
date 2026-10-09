import { translateIfKnown, type Locale, type TFunction, type TranslationKey } from '@/i18n';
import type { StoreOrderAction } from '@/types/store-manager';

/**
 * THE WORDS ON THE STORE CONSOLE
 *
 * Same rule as the order copy: the API names each action ("Mark packed") but it
 * also sends a stable `action` key, and English keeps showing the server's own
 * label while every other language is built from the key. A button can therefore
 * never go missing, or read wrongly, because the API reworded something.
 */
export function actionLabel(
  action: Pick<StoreOrderAction, 'action' | 'label'>,
  t: TFunction,
  locale: Locale,
): string {
  if (locale === 'en' && action.label) return action.label;
  return t(('store.action.' + action.action) as TranslationKey);
}

/** Who made a change. An unrecognised role is shown as the API sent it. */
export function roleLabel(role: string, locale: Locale): string {
  return translateIfKnown(locale, 'store.role.' + role) ?? role;
}

/** Why a stock level changed. An unrecognised reason is shown as the API sent it. */
export function stockReasonLabel(reason: string, locale: Locale): string {
  return translateIfKnown(locale, 'store.stockReason.' + reason) ?? reason;
}

// Barrel export — importa tudo de um lugar só
export { type Locale, DEFAULT_LOCALE, SUPPORTED_LOCALES, LOCALE_LABELS, LOCALE_FLAGS } from './types';
export { getDictionary, type Dictionary } from './dictionaries';
export { LocaleProvider, useT, useLocale, useI18n } from './context';
export { interpolate } from './interpolate';
export {
  getDateLocale,
  formatLocalDate,
  formatLocalNumber,
  formatLocalCurrency,
} from './date-utils';

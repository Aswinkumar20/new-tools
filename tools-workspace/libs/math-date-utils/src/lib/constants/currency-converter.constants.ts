import type { MdRelatedToolLink } from '../shared/md-tool-suggestion.model';
import type { CurrencyDescriptor } from '../types/currency-converter.types';

/** Auto-refresh interval for live FX rates. */
export const CURRENCY_REFRESH_INTERVAL_MS = 180_000; // 3 minutes

/** Client-side cache TTL before a forced network refresh is preferred. */
export const CURRENCY_RATE_CACHE_TTL_MS = 60_000;

export const CURRENCY_DEFAULT_BASE = 'USD';
export const CURRENCY_DEFAULT_QUOTE = 'EUR';
export const CURRENCY_DEFAULT_AMOUNT = '100';
export const CURRENCY_DEFAULT_FEE_PERCENT = '0.5';

export const CURRENCY_DEFAULT_WATCHLIST: ReadonlyArray<string> = [
  'EUR',
  'GBP',
  'JPY',
  'INR',
  'AUD',
  'CAD'
];

export const CURRENCY_TOP_MOVERS_LIMIT = 6;

export const CURRENCY_PRIMARY_RATES_URL = 'https://open.er-api.com/v6/latest';
export const CURRENCY_FALLBACK_RATES_URL = 'https://api.exchangerate.host/latest';

export const CURRENCY_METADATA: ReadonlyArray<CurrencyDescriptor> = [
  { code: 'USD', name: 'United States Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound Sterling', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: '$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: '$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: '$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: '$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: '$' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'AED', name: 'United Arab Emirates Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪' },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$' },
  { code: 'COP', name: 'Colombian Peso', symbol: '$' },
  { code: 'VND', name: 'Vietnamese Đồng', symbol: '₫' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: '£' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei' },
  { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn' },
  { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин.' },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs' },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: '$' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'ب.د' }
];

export const CURRENCY_RELATED_TOOLS: ReadonlyArray<MdRelatedToolLink> = [
  {
    label: 'Unit Converter',
    path: '/math-date-utils/unit-converter',
    description: 'Convert non-currency units after FX calculations'
  },
  {
    label: 'Percentage Calculator',
    path: '/math-date-utils/percentage-calculator',
    description: 'Work out fee percentages or rate changes'
  },
  {
    label: 'Number to Words',
    path: '/math-date-utils/number-to-words',
    description: 'Spell out converted amounts for invoices or cheques'
  },
  {
    label: 'Timezone Converter',
    path: '/fun-tools/timezone-converter',
    description: 'Align market hours when planning transfers'
  }
];

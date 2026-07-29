import type { TtToolSuggestion } from '../shared/tt-tool-suggestion.model';
import {
  CREDIT_CARD_BRAND_LABELS,
  CREDIT_CARD_EXPIRY_PATTERN,
  CREDIT_CARD_NUMBER_MAX_DIGITS
} from '../constants/credit-card-validator.constants';
import type {
  CardBrand,
  CardValidationResult,
  CreditCardFormValues,
  CreditCardSuggestionContext
} from '../types/credit-card-validator.types';

export function extractCardDigits(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

export function formatCardNumber(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function getCardBrandLabel(brand: CardBrand): string {
  return CREDIT_CARD_BRAND_LABELS[brand];
}

export function detectCardBrand(digits: string): CardBrand {
  if (!digits) {
    return 'unknown';
  }
  if (/^4[0-9]{0,}$/.test(digits)) {
    return 'visa';
  }
  if (/^(5[1-5][0-9]{0,}|2(2[2-9][0-9]{0,}|[3-6][0-9]{0,}|7[01][0-9]{0,}|720[0-9]{0,}))$/.test(digits)) {
    return 'mastercard';
  }
  if (/^3[47][0-9]{0,}$/.test(digits)) {
    return 'amex';
  }
  if (/^6(?:011|5[0-9]{2})[0-9]{0,}$/.test(digits)) {
    return 'discover';
  }
  if (/^3(?:0[0-5]|[68][0-9])[0-9]{0,}$/.test(digits)) {
    return 'diners';
  }
  if (/^(?:2131|1800|35[0-9]{0,})[0-9]{0,}$/.test(digits)) {
    return 'jcb';
  }
  if (/^62[0-9]{0,}$/.test(digits)) {
    return 'unionpay';
  }
  return 'unknown';
}

export function isCardLengthValidForBrand(length: number, brand: CardBrand): boolean {
  if (!length) {
    return false;
  }
  switch (brand) {
    case 'visa':
      return length === 13 || length === 16 || length === 19;
    case 'mastercard':
      return length === 16;
    case 'amex':
      return length === 15;
    case 'discover':
      return length === 16;
    case 'diners':
      return length === 14;
    case 'jcb':
      return length >= 16 && length <= 19;
    case 'unionpay':
      return length >= 16 && length <= 19;
    default:
      return length >= 12 && length <= 19;
  }
}

export function luhnCheck(digits: string): boolean {
  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits.charAt(i));
    if (Number.isNaN(digit)) {
      return false;
    }
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function isCardExpiryValid(expiry: string, now: Date = new Date()): boolean {
  const match = expiry.match(CREDIT_CARD_EXPIRY_PATTERN);
  if (!match) {
    return false;
  }
  const month = Number(match[1]);
  const year = Number(`20${match[2]}`);

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear || year > currentYear + 20) {
    return false;
  }
  if (year === currentYear && month < currentMonth) {
    return false;
  }
  return true;
}

export function isCardCvvValid(cvv: string, brand: CardBrand): boolean {
  if (!cvv) {
    return false;
  }
  const len = cvv.replace(/\D/g, '').length;
  if (brand === 'amex') {
    return len === 4;
  }
  return len === 3;
}

export function getMaskedCardNumber(digits: string, mask: boolean): string {
  if (!digits) {
    return '';
  }
  const formatted = formatCardNumber(digits);
  if (!mask) {
    return formatted;
  }
  const visible = formatted.replace(/\s/g, '').slice(-4);
  return formatted
    .replace(/\d/g, '•')
    .split(' ')
    .map((group, index, arr) => (index === arr.length - 1 ? visible : group))
    .join(' ');
}

export function normalizeCardNumberInput(rawValue: string): string {
  let digits = extractCardDigits(rawValue);
  if (digits.length > CREDIT_CARD_NUMBER_MAX_DIGITS) {
    digits = digits.substring(0, CREDIT_CARD_NUMBER_MAX_DIGITS);
  }
  return formatCardNumber(digits);
}

export function validateCreditCard(values: CreditCardFormValues): CardValidationResult {
  const messages: string[] = [];
  const digits = extractCardDigits(values.number);
  const brand = detectCardBrand(digits);
  const brandLabel = getCardBrandLabel(brand);

  const luhnValid = digits.length >= 12 && luhnCheck(digits);
  const lengthValid = isCardLengthValidForBrand(digits.length, brand);

  if (!digits) {
    messages.push('Enter a card number to validate.');
  } else {
    if (!luhnValid) {
      messages.push('Card number failed the Luhn check.');
    }
    if (!lengthValid) {
      messages.push('Card number length does not match typical length for this brand.');
    }
  }

  const expiryValid = isCardExpiryValid(values.expiry);
  if (!expiryValid) {
    messages.push('Expiry date is invalid or in the past.');
  }

  const cvvValid = isCardCvvValid(values.cvv, brand);
  if (!cvvValid) {
    messages.push('CVV length is invalid for this brand.');
  }

  const valid = !!digits && luhnValid && lengthValid && expiryValid && cvvValid;

  return {
    brand,
    brandLabel,
    valid,
    luhnValid,
    lengthValid,
    expiryValid,
    cvvValid,
    messages
  };
}

export function buildCreditCardValidationSummary(result: CardValidationResult): string {
  const lines = [
    `Status: ${result.valid ? 'Valid' : 'Invalid'}`,
    `Brand: ${result.brandLabel}`,
    `Luhn: ${result.luhnValid ? 'Pass' : 'Fail'}`,
    `Length: ${result.lengthValid ? 'Pass' : 'Fail'}`,
    `Expiry: ${result.expiryValid ? 'Valid' : 'Invalid'}`,
    `CVV: ${result.cvvValid ? 'Valid' : 'Invalid'}`,
    ...result.messages.map((m) => `- ${m}`)
  ];
  return lines.join('\n');
}

export function resolveCreditCardSuggestion(
  context: CreditCardSuggestionContext
): TtToolSuggestion | null {
  const { hasDigits, brand, result } = context;

  if (!hasDigits) {
    return {
      id: 'ccv-get-started',
      title: 'Validate a card structure?',
      reason:
        'Enter a number to detect brand and run Luhn locally. This never sends card data to a server.',
      actionLabel: 'Open Email / URL / IP Checker',
      path: '/testing-tools/email-url-ip-checker'
    };
  }

  if (!result.luhnValid && result.messages.some((m) => m.includes('Luhn'))) {
    return {
      id: 'ccv-luhn-fail',
      title: 'Luhn check failed',
      reason:
        'The number fails the checksum used by most card issuers. Re-check digits for typos before testing payment flows.',
      actionLabel: 'Open JSON Schema Validator',
      path: '/testing-tools/json-schema-validator'
    };
  }

  if (!result.lengthValid) {
    return {
      id: 'ccv-length',
      title: 'Unusual length for this brand',
      reason: `${result.brandLabel} numbers usually use a fixed length. Confirm the brand detection and digit count.`,
      actionLabel: 'Open Password Rule Validator',
      path: '/testing-tools/password-rule-validator'
    };
  }

  if (!result.expiryValid || !result.cvvValid) {
    return {
      id: 'ccv-fields',
      title: 'Expiry or CVV needs attention',
      reason:
        brand === 'amex'
          ? 'American Express typically expects a 4-digit CVV and a future MM/YY expiry.'
          : 'Use MM/YY for expiry and a 3-digit CVV for this brand.',
      actionLabel: 'Open Email / URL / IP Checker',
      path: '/testing-tools/email-url-ip-checker'
    };
  }

  if (result.valid) {
    return {
      id: 'ccv-valid',
      title: 'Structure looks valid',
      reason:
        'Checksum and field lengths passed. This does not prove the card is real or authorized — use schema checks for API payloads next.',
      actionLabel: 'Open JSON Schema Validator',
      path: '/testing-tools/json-schema-validator'
    };
  }

  return {
    id: 'ccv-review',
    title: 'Review validation details',
    reason: 'Fix the listed issues, then re-check. For password-style secrets, use Password Rule Validator instead.',
    actionLabel: 'Open Password Rule Validator',
    path: '/testing-tools/password-rule-validator'
  };
}

import { Validators } from '@angular/forms';
import type { TtRelatedToolLink } from '../shared/tt-tool-suggestion.model';
import type { CardBrand, CreditCardFormValues } from '../types/credit-card-validator.types';

export const CREDIT_CARD_DEFAULT_FORM: CreditCardFormValues = {
  number: '',
  name: '',
  expiry: '',
  cvv: ''
};

export const CREDIT_CARD_NUMBER_MAX_DIGITS = 19;

export const CREDIT_CARD_EXPIRY_PATTERN = /^(0[1-9]|1[0-2])\/?([0-9]{2})$/;

export const CREDIT_CARD_BRAND_LABELS: Readonly<Record<CardBrand, string>> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay',
  unknown: 'Unknown'
};

export const CREDIT_CARD_NUMBER_VALIDATORS = [
  Validators.required,
  Validators.minLength(12),
  Validators.maxLength(19)
];

export const CREDIT_CARD_NAME_VALIDATORS = [
  Validators.required,
  Validators.minLength(2),
  Validators.maxLength(50)
];

export const CREDIT_CARD_EXPIRY_VALIDATORS = [
  Validators.required,
  Validators.pattern(CREDIT_CARD_EXPIRY_PATTERN)
];

export const CREDIT_CARD_CVV_VALIDATORS = [
  Validators.required,
  Validators.minLength(3),
  Validators.maxLength(4)
];

export const CREDIT_CARD_RELATED_TOOLS: ReadonlyArray<TtRelatedToolLink> = [
  {
    label: 'Password Rule Validator',
    path: '/testing-tools/password-rule-validator',
    description: 'Validate password policy rules alongside payment form checks'
  },
  {
    label: 'Email / URL / IP Checker',
    path: '/testing-tools/email-url-ip-checker',
    description: 'Validate related contact or endpoint fields in the same flow'
  },
  {
    label: 'JSON Schema Validator',
    path: '/testing-tools/json-schema-validator',
    description: 'Validate payment payloads against a schema in API tests'
  },
  {
    label: 'Random Password Generator',
    path: '/security-tools/random-password-generator',
    description: 'Generate test secrets when you need credentials, not card numbers'
  }
];

import type { FormControl, FormGroup } from '@angular/forms';

export type CardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'diners'
  | 'jcb'
  | 'unionpay'
  | 'unknown';

export interface CardValidationResult {
  brand: CardBrand;
  brandLabel: string;
  valid: boolean;
  luhnValid: boolean;
  lengthValid: boolean;
  expiryValid: boolean;
  cvvValid: boolean;
  messages: string[];
}

export type CreditCardFormGroup = FormGroup<{
  number: FormControl<string>;
  name: FormControl<string>;
  expiry: FormControl<string>;
  cvv: FormControl<string>;
}>;

export interface CreditCardFormValues {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
}

export interface CreditCardSuggestionContext {
  hasDigits: boolean;
  brand: CardBrand;
  result: CardValidationResult;
}

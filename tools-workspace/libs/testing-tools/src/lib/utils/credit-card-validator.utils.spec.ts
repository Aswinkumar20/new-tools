import {
  detectCardBrand,
  formatCardNumber,
  getMaskedCardNumber,
  isCardCvvValid,
  isCardExpiryValid,
  luhnCheck,
  resolveCreditCardSuggestion,
  validateCreditCard
} from './credit-card-validator.utils';

describe('credit-card-validator.utils', () => {
  it('detects brands and formats numbers', () => {
    expect(detectCardBrand('4111111111111111')).toBe('visa');
    expect(detectCardBrand('5500000000000004')).toBe('mastercard');
    expect(detectCardBrand('340000000000009')).toBe('amex');
    expect(formatCardNumber('4111111111111111')).toBe('4111 1111 1111 1111');
  });

  it('runs Luhn and field checks', () => {
    expect(luhnCheck('4111111111111111')).toBe(true);
    expect(luhnCheck('4111111111111112')).toBe(false);
    expect(isCardCvvValid('1234', 'amex')).toBe(true);
    expect(isCardCvvValid('123', 'visa')).toBe(true);
    expect(isCardCvvValid('12', 'visa')).toBe(false);

    const now = new Date(2026, 6, 20);
    expect(isCardExpiryValid('07/26', now)).toBe(true);
    expect(isCardExpiryValid('06/26', now)).toBe(false);
    expect(isCardExpiryValid('13/26', now)).toBe(false);
  });

  it('masks numbers and validates full cards', () => {
    const masked = getMaskedCardNumber('4111111111111111', true);
    expect(masked.endsWith('1111')).toBe(true);
    expect(masked).toContain('•');

    const valid = validateCreditCard({
      number: '4111 1111 1111 1111',
      name: 'Test',
      expiry: '12/28',
      cvv: '123'
    });
    expect(valid.valid).toBe(true);
    expect(valid.brand).toBe('visa');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveCreditCardSuggestion({
        hasDigits: false,
        brand: 'unknown',
        result: validateCreditCard({ number: '', name: '', expiry: '', cvv: '' })
      })?.id
    ).toBe('ccv-get-started');

    const luhnFail = validateCreditCard({
      number: '4111111111111112',
      name: 'Test',
      expiry: '12/28',
      cvv: '123'
    });
    expect(
      resolveCreditCardSuggestion({
        hasDigits: true,
        brand: luhnFail.brand,
        result: luhnFail
      })?.id
    ).toBe('ccv-luhn-fail');
  });
});

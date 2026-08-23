import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'diners' | 'jcb' | 'unionpay' | 'unknown';

interface CardValidationResult {
  brand: CardBrand;
  brandLabel: string;
  valid: boolean;
  luhnValid: boolean;
  lengthValid: boolean;
  expiryValid: boolean;
  cvvValid: boolean;
  messages: string[];
}

type CreditCardFormGroup = FormGroup<{
  number: FormControl<string>;
  name: FormControl<string>;
  expiry: FormControl<string>;
  cvv: FormControl<string>;
}>;

@Component({
  selector: 'lib-credit-card-validator',
  standalone: true,
  templateUrl: './credit-card-validator.html',
  styleUrls: ['./credit-card-validator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreditCardValidatorComponent {
  private readonly fb = inject(FormBuilder);

  readonly form: CreditCardFormGroup = this.fb.group({
    number: this.fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12), Validators.maxLength(19)]
    }),
    name: this.fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(50)]
    }),
    expiry: this.fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/)]
    }),
    cvv: this.fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(4)]
    })
  });

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly showNumberMasked = signal(true);

  readonly cardNumberDigits = computed(() =>
    this.form.controls.number.value.replace(/[^0-9]/g, '')
  );

  readonly brand = computed<CardBrand>(() => this.detectBrand(this.cardNumberDigits()));

  readonly brandLabel = computed(() => this.getBrandLabel(this.brand()));

  readonly validationResult = computed<CardValidationResult>(() => this.validateCard());

  readonly maskedNumber = computed(() => this.getMaskedNumber(this.cardNumberDigits(), this.showNumberMasked()));

  readonly formattedNumber = computed(() => this.formatNumber(this.cardNumberDigits()));

  readonly isValid = computed(() => this.validationResult().valid);

  toggleMask(): void {
    this.showNumberMasked.update((v) => !v);
  }

  onNumberInput(): void {
    const digits = this.cardNumberDigits();
    // Auto-limit to 19 digits
    if (digits.length > 19) {
      const trimmed = digits.substring(0, 19);
      this.form.controls.number.setValue(this.formatNumber(trimmed));
    } else {
      this.form.controls.number.setValue(this.formatNumber(digits), { emitEvent: false });
    }
  }

  private validateCard(): CardValidationResult {
    const messages: string[] = [];
    const digits = this.cardNumberDigits();
    const brand = this.brand();
    const brandLabel = this.getBrandLabel(brand);

    const luhnValid = digits.length >= 12 && this.luhnCheck(digits);
    const lengthValid = this.isLengthValidForBrand(digits.length, brand);

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

    const expiryValid = this.isExpiryValid(this.form.controls.expiry.value);
    if (!expiryValid) {
      messages.push('Expiry date is invalid or in the past.');
    }

    const cvvValid = this.isCvvValid(this.form.controls.cvv.value, brand);
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

  private detectBrand(digits: string): CardBrand {
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

  private getBrandLabel(brand: CardBrand): string {
    switch (brand) {
      case 'visa':
        return 'Visa';
      case 'mastercard':
        return 'Mastercard';
      case 'amex':
        return 'American Express';
      case 'discover':
        return 'Discover';
      case 'diners':
        return 'Diners Club';
      case 'jcb':
        return 'JCB';
      case 'unionpay':
        return 'UnionPay';
      default:
        return 'Unknown';
    }
  }

  private isLengthValidForBrand(length: number, brand: CardBrand): boolean {
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

  private luhnCheck(digits: string): boolean {
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

  private isExpiryValid(expiry: string): boolean {
    const match = expiry.match(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/);
    if (!match) {
      return false;
    }
    const month = Number(match[1]);
    const year = Number(`20${match[2]}`);

    const now = new Date();
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

  private isCvvValid(cvv: string, brand: CardBrand): boolean {
    if (!cvv) {
      return false;
    }
    const len = cvv.replace(/\\D/g, '').length;
    if (brand === 'amex') {
      return len === 4;
    }
    return len === 3;
  }

  private getMaskedNumber(digits: string, mask: boolean): string {
    if (!digits) {
      return '';
    }
    const formatted = this.formatNumber(digits);
    if (!mask) {
      return formatted;
    }
    const visible = formatted.replace(/\\s/g, '').slice(-4);
    const maskedSection = formatted
      .replace(/\\d/g, '•')
      .split(' ')
      .map((group, index, arr) =>
        index === arr.length - 1 ? visible : group
      )
      .join(' ');
    return maskedSection;
  }

  private formatNumber(digits: string): string {
    return digits.replace(/(\\d{4})(?=\\d)/g, '$1 ').trim();
  }
}

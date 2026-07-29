import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Navigation,
  TooltipDirective,
  AssetService,
  ToastService
} from '@tools-workspace/features-home';
import type { TtRelatedToolLink } from '../../shared/tt-tool-suggestion.model';
import { ttCopyText } from '../../shared/tt-clipboard.util';
import {
  CREDIT_CARD_CVV_VALIDATORS,
  CREDIT_CARD_DEFAULT_FORM,
  CREDIT_CARD_EXPIRY_VALIDATORS,
  CREDIT_CARD_NAME_VALIDATORS,
  CREDIT_CARD_NUMBER_MAX_DIGITS,
  CREDIT_CARD_NUMBER_VALIDATORS,
  CREDIT_CARD_RELATED_TOOLS
} from '../../constants/credit-card-validator.constants';
import type {
  CreditCardFormGroup,
  CreditCardFormValues
} from '../../types/credit-card-validator.types';
import {
  buildCreditCardValidationSummary,
  detectCardBrand,
  extractCardDigits,
  formatCardNumber,
  getCardBrandLabel,
  getMaskedCardNumber,
  resolveCreditCardSuggestion,
  validateCreditCard
} from '../../utils/credit-card-validator.utils';

@Component({
  selector: 'lib-credit-card-validator',
  standalone: true,
  templateUrl: './credit-card-validator.html',
  styleUrls: ['./credit-card-validator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreditCardValidatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly relatedTools: ReadonlyArray<TtRelatedToolLink> = CREDIT_CARD_RELATED_TOOLS;

  readonly form: CreditCardFormGroup = this.fb.group({
    number: this.fb.control(CREDIT_CARD_DEFAULT_FORM.number, {
      nonNullable: true,
      validators: [...CREDIT_CARD_NUMBER_VALIDATORS]
    }),
    name: this.fb.control(CREDIT_CARD_DEFAULT_FORM.name, {
      nonNullable: true,
      validators: [...CREDIT_CARD_NAME_VALIDATORS]
    }),
    expiry: this.fb.control(CREDIT_CARD_DEFAULT_FORM.expiry, {
      nonNullable: true,
      validators: [...CREDIT_CARD_EXPIRY_VALIDATORS]
    }),
    cvv: this.fb.control(CREDIT_CARD_DEFAULT_FORM.cvv, {
      nonNullable: true,
      validators: [...CREDIT_CARD_CVV_VALIDATORS]
    })
  });

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly showNumberMasked = signal(true);
  readonly formSnapshot = signal<CreditCardFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly cardNumberDigits = computed(() => extractCardDigits(this.formSnapshot().number));

  readonly brand = computed(() => detectCardBrand(this.cardNumberDigits()));

  readonly brandLabel = computed(() => getCardBrandLabel(this.brand()));

  readonly validationResult = computed(() => validateCreditCard(this.formSnapshot()));

  readonly maskedNumber = computed(() =>
    getMaskedCardNumber(this.cardNumberDigits(), this.showNumberMasked())
  );

  readonly formattedNumber = computed(() => formatCardNumber(this.cardNumberDigits()));

  readonly isValid = computed(() => this.validationResult().valid);

  readonly hasInput = computed(() => !!this.cardNumberDigits().length);

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveCreditCardSuggestion({
      hasDigits: this.hasInput(),
      brand: this.brand(),
      result: this.validationResult()
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formSnapshot.set(this.readFormValues());
    });
  }

  toggleMask(): void {
    this.showNumberMasked.update((v) => !v);
  }

  onNumberInput(): void {
    const digits = extractCardDigits(this.form.controls.number.value);
    if (digits.length > CREDIT_CARD_NUMBER_MAX_DIGITS) {
      const trimmed = digits.substring(0, CREDIT_CARD_NUMBER_MAX_DIGITS);
      this.form.controls.number.setValue(formatCardNumber(trimmed));
    } else {
      this.form.controls.number.setValue(formatCardNumber(digits), { emitEvent: false });
      this.formSnapshot.set(this.readFormValues());
    }
  }

  clear(): void {
    this.form.reset({ ...CREDIT_CARD_DEFAULT_FORM });
    this.errors.set([]);
    this.warnings.set([]);
    this.dismissedSuggestionId.set(null);
    this.formSnapshot.set(this.readFormValues());
    this.toast.info('Cleared');
  }

  async copyInput(): Promise<void> {
    await ttCopyText(this.toast, this.formattedNumber(), 'Card number');
  }

  async copyOutput(): Promise<void> {
    await ttCopyText(
      this.toast,
      buildCreditCardValidationSummary(this.validationResult()),
      'Validation summary'
    );
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private readFormValues(): CreditCardFormValues {
    return this.form.getRawValue();
  }
}

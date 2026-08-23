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
import type { StRelatedToolLink } from '../../shared/st-tool-suggestion.model';
import { stCopyText } from '../../shared/st-clipboard.util';
import {
  RANDOM_PASSWORD_DEFAULT_FORM,
  RANDOM_PASSWORD_RELATED_TOOLS
} from '../../constants/random-password-generator.constants';
import type {
  GeneratedPassword,
  RandomPasswordFormGroup,
  RandomPasswordFormValues
} from '../../types/random-password-generator.types';
import {
  formatGeneratedPasswordTime,
  generateRandomPassword,
  resolveGeneratedPasswordStrength,
  resolveGeneratedPasswordStrengthLabel,
  resolveGeneratedPasswordStrengthPercent,
  resolveRandomPasswordSuggestion
} from '../../utils/random-password-generator.utils';

@Component({
  selector: 'lib-random-password-generator',
  standalone: true,
  templateUrl: './random-password-generator.html',
  styleUrls: ['./random-password-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RandomPasswordGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly relatedTools: ReadonlyArray<StRelatedToolLink> = RANDOM_PASSWORD_RELATED_TOOLS;

  readonly form: RandomPasswordFormGroup = this.fb.group({
    length: this.fb.control(RANDOM_PASSWORD_DEFAULT_FORM.length, { nonNullable: true }),
    includeLowercase: this.fb.control(RANDOM_PASSWORD_DEFAULT_FORM.includeLowercase, {
      nonNullable: true
    }),
    includeUppercase: this.fb.control(RANDOM_PASSWORD_DEFAULT_FORM.includeUppercase, {
      nonNullable: true
    }),
    includeNumbers: this.fb.control(RANDOM_PASSWORD_DEFAULT_FORM.includeNumbers, {
      nonNullable: true
    }),
    includeSymbols: this.fb.control(RANDOM_PASSWORD_DEFAULT_FORM.includeSymbols, {
      nonNullable: true
    }),
    avoidAmbiguous: this.fb.control(RANDOM_PASSWORD_DEFAULT_FORM.avoidAmbiguous, {
      nonNullable: true
    })
  });

  readonly errors = signal<string[]>([]);
  readonly password = signal<GeneratedPassword | null>(null);
  readonly formSnapshot = signal<RandomPasswordFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasPassword = computed(() => this.password() !== null);

  readonly passwordLength = computed(() => {
    const generated = this.password();
    return generated ? generated.value.length : this.formSnapshot().length;
  });

  readonly strengthLevel = computed(() =>
    resolveGeneratedPasswordStrength(this.password()?.value ?? '')
  );

  readonly strengthLabel = computed(() =>
    resolveGeneratedPasswordStrengthLabel(this.strengthLevel())
  );

  readonly strengthPercent = computed(() =>
    resolveGeneratedPasswordStrengthPercent(this.strengthLevel())
  );

  readonly generatedTimeLabel = computed(() =>
    formatGeneratedPasswordTime(this.password()?.createdAt ?? null)
  );

  readonly primarySuggestion = computed(() => {
    const generated = this.password();
    const suggestion = resolveRandomPasswordSuggestion({
      hasPassword: this.hasPassword(),
      hasError: this.errors().length > 0,
      errorMessage: this.errors()[0] ?? null,
      length: generated?.value.length ?? this.formSnapshot().length,
      strengthLevel: this.strengthLevel()
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

  generate(): void {
    this.dismissedSuggestionId.set(null);
    const { password, errors } = generateRandomPassword(this.form.getRawValue());
    this.errors.set(errors);
    this.password.set(password);
  }

  async copyToClipboard(): Promise<void> {
    const value = this.password()?.value;
    if (!value) {
      return;
    }
    const copied = await stCopyText(this.toast, value, 'Password');
    if (!copied) {
      this.errors.set(['Failed to copy password to clipboard.']);
    }
  }

  clear(): void {
    this.password.set(null);
    this.errors.set([]);
    this.dismissedSuggestionId.set(null);
    this.toast.info('Password cleared');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private readFormValues(): RandomPasswordFormValues {
    return this.form.getRawValue();
  }
}

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
  PASSWORD_RULE_DEFAULT_FORM,
  PASSWORD_RULE_RELATED_TOOLS
} from '../../constants/password-rule-validator.constants';
import type {
  PasswordRuleFormGroup,
  PasswordRuleFormValues
} from '../../types/password-rule-validator.types';
import {
  buildPasswordRuleChecklistText,
  evaluatePasswordRuleForm,
  resolvePasswordRuleSuggestion
} from '../../utils/password-rule-validator.utils';

@Component({
  selector: 'lib-password-rule-validator',
  standalone: true,
  templateUrl: './password-rule-validator.html',
  styleUrls: ['./password-rule-validator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PasswordRuleValidatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly relatedTools: ReadonlyArray<TtRelatedToolLink> = PASSWORD_RULE_RELATED_TOOLS;
  readonly showPassword = signal(false);
  readonly formSnapshot = signal<PasswordRuleFormValues>(PASSWORD_RULE_DEFAULT_FORM);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly form: PasswordRuleFormGroup = this.fb.group({
    password: this.fb.control(PASSWORD_RULE_DEFAULT_FORM.password, { nonNullable: true }),
    minLength: this.fb.control(PASSWORD_RULE_DEFAULT_FORM.minLength, { nonNullable: true }),
    requireUppercase: this.fb.control(PASSWORD_RULE_DEFAULT_FORM.requireUppercase, {
      nonNullable: true
    }),
    requireLowercase: this.fb.control(PASSWORD_RULE_DEFAULT_FORM.requireLowercase, {
      nonNullable: true
    }),
    requireNumber: this.fb.control(PASSWORD_RULE_DEFAULT_FORM.requireNumber, {
      nonNullable: true
    }),
    requireSymbol: this.fb.control(PASSWORD_RULE_DEFAULT_FORM.requireSymbol, {
      nonNullable: true
    }),
    noSpaces: this.fb.control(PASSWORD_RULE_DEFAULT_FORM.noSpaces, { nonNullable: true }),
    noCommon: this.fb.control(PASSWORD_RULE_DEFAULT_FORM.noCommon, { nonNullable: true })
  });

  private readonly evaluation = computed(() => evaluatePasswordRuleForm(this.formSnapshot()));

  readonly rules = computed(() => this.evaluation().rules);
  readonly passedCount = computed(() => this.evaluation().passedCount);
  readonly totalCount = computed(() => this.evaluation().totalCount);
  readonly strengthLevel = computed(() => this.evaluation().strengthLevel);
  readonly strengthLabel = computed(() => this.evaluation().strengthLabel);
  readonly strengthPercent = computed(() => this.evaluation().strengthPercent);
  readonly hasInput = computed(() => !!this.formSnapshot().password.length);
  readonly allPassed = computed(() => this.evaluation().allPassed);
  readonly passwordLength = computed(() => this.formSnapshot().password.length);

  readonly primarySuggestion = computed(() => {
    const evaluation = this.evaluation();
    const suggestion = resolvePasswordRuleSuggestion({
      hasInput: this.hasInput(),
      allPassed: evaluation.allPassed,
      failedRuleIds: evaluation.rules.filter((rule) => !rule.passed).map((rule) => rule.id),
      strengthLevel: evaluation.strengthLevel
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formSnapshot.set(this.form.getRawValue());
      this.dismissedSuggestionId.set(null);
    });
  }

  toggleShowPassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  clear(): void {
    this.form.controls.password.setValue('');
    this.showPassword.set(false);
    this.dismissedSuggestionId.set(null);
    this.toast.info('Cleared');
  }

  async copyInput(): Promise<void> {
    await ttCopyText(this.toast, this.form.controls.password.value, 'Password');
  }

  async copyOutput(): Promise<void> {
    await ttCopyText(
      this.toast,
      buildPasswordRuleChecklistText(this.evaluation()),
      'Rule checklist'
    );
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }
}

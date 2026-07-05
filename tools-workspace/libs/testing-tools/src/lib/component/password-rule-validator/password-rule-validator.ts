import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

type StrengthLevel = 'very-weak' | 'weak' | 'medium' | 'strong' | 'very-strong';

interface RuleConfig {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  optional?: boolean;
}

interface RuleStatus extends RuleConfig {
  passed: boolean;
}

type PasswordRuleFormGroup = FormGroup<{
  password: FormControl<string>;
  minLength: FormControl<number>;
  requireUppercase: FormControl<boolean>;
  requireLowercase: FormControl<boolean>;
  requireNumber: FormControl<boolean>;
  requireSymbol: FormControl<boolean>;
  noSpaces: FormControl<boolean>;
  noCommon: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-password-rule-validator',
  standalone: true,
  templateUrl: './password-rule-validator.html',
  styleUrls: ['./password-rule-validator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PasswordRuleValidatorComponent {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly showPassword = signal(false);

  readonly form: PasswordRuleFormGroup = this.fb.group({
    password: this.fb.control('', { nonNullable: true }),
    minLength: this.fb.control(12, { nonNullable: true }),
    requireUppercase: this.fb.control(true, { nonNullable: true }),
    requireLowercase: this.fb.control(true, { nonNullable: true }),
    requireNumber: this.fb.control(true, { nonNullable: true }),
    requireSymbol: this.fb.control(true, { nonNullable: true }),
    noSpaces: this.fb.control(true, { nonNullable: true }),
    noCommon: this.fb.control(true, { nonNullable: true })
  });

  readonly commonPasswords = [
    'password',
    '123456',
    '123456789',
    'qwerty',
    '12345678',
    '111111',
    '123123',
    'password1',
    'iloveyou'
  ];

  readonly baseRules: RuleConfig[] = [
    {
      id: 'minLength',
      label: 'Minimum length',
      description: 'Password should meet the minimum length requirement.',
      enabled: true
    },
    {
      id: 'uppercase',
      label: 'Uppercase letter',
      description: 'At least one uppercase letter (A–Z).',
      enabled: true
    },
    {
      id: 'lowercase',
      label: 'Lowercase letter',
      description: 'At least one lowercase letter (a–z).',
      enabled: true
    },
    {
      id: 'number',
      label: 'Number',
      description: 'At least one digit (0–9).',
      enabled: true
    },
    {
      id: 'symbol',
      label: 'Symbol',
      description: 'At least one symbol (e.g. !@#$%^&*).',
      enabled: true
    },
    {
      id: 'noSpaces',
      label: 'No spaces',
      description: 'Password should not contain spaces.',
      enabled: true
    },
    {
      id: 'noCommon',
      label: 'Not common',
      description: 'Password should not be a very common password.',
      enabled: true
    }
  ];

  readonly errors = signal<string[]>([]);

  readonly rules = computed<RuleStatus[]>(() => {
    const pwd = this.form.controls.password.value;
    const { minLength, requireUppercase, requireLowercase, requireNumber, requireSymbol, noSpaces, noCommon } =
      this.form.getRawValue();

    const statuses: RuleStatus[] = [];

    statuses.push({
      ...this.baseRules.find((r) => r.id === 'minLength')!,
      passed: pwd.length >= minLength
    });

    if (requireUppercase) {
      statuses.push({
        ...this.baseRules.find((r) => r.id === 'uppercase')!,
        passed: /[A-Z]/.test(pwd)
      });
    }

    if (requireLowercase) {
      statuses.push({
        ...this.baseRules.find((r) => r.id === 'lowercase')!,
        passed: /[a-z]/.test(pwd)
      });
    }

    if (requireNumber) {
      statuses.push({
        ...this.baseRules.find((r) => r.id === 'number')!,
        passed: /[0-9]/.test(pwd)
      });
    }

    if (requireSymbol) {
      statuses.push({
        ...this.baseRules.find((r) => r.id === 'symbol')!,
        passed: /[^A-Za-z0-9\s]/.test(pwd)
      });
    }

    if (noSpaces) {
      statuses.push({
        ...this.baseRules.find((r) => r.id === 'noSpaces')!,
        passed: !/\s/.test(pwd)
      });
    }

    if (noCommon) {
      const lower = pwd.toLowerCase();
      statuses.push({
        ...this.baseRules.find((r) => r.id === 'noCommon')!,
        passed: !this.commonPasswords.includes(lower)
      });
    }

    return statuses;
  });

  readonly passedCount = computed(() => this.rules().filter((r) => r.passed).length);
  readonly totalCount = computed(() => this.rules().length);

  readonly strengthLevel = computed<StrengthLevel>(() => {
    const pwd = this.form.controls.password.value;
    if (!pwd) {
      return 'very-weak';
    }
    const lengthScore = Math.min(pwd.length / 4, 4); // 0–4
    let varietyScore = 0;
    if (/[A-Z]/.test(pwd)) varietyScore++;
    if (/[a-z]/.test(pwd)) varietyScore++;
    if (/[0-9]/.test(pwd)) varietyScore++;
    if (/[^A-Za-z0-9\s]/.test(pwd)) varietyScore++;

    const ruleScore = this.totalCount() === 0 ? 0 : (this.passedCount() / this.totalCount()) * 4;

    const score = lengthScore + varietyScore + ruleScore; // 0–12

    if (score >= 10) return 'very-strong';
    if (score >= 8) return 'strong';
    if (score >= 6) return 'medium';
    if (score >= 3) return 'weak';
    return 'very-weak';
  });

  readonly strengthLabel = computed(() => {
    switch (this.strengthLevel()) {
      case 'very-weak':
        return 'Very weak';
      case 'weak':
        return 'Weak';
      case 'medium':
        return 'Medium';
      case 'strong':
        return 'Strong';
      case 'very-strong':
        return 'Very strong';
    }
  });

  readonly strengthPercent = computed(() => {
    const levels: StrengthLevel[] = ['very-weak', 'weak', 'medium', 'strong', 'very-strong'];
    const index = levels.indexOf(this.strengthLevel());
    return ((index + 1) / levels.length) * 100;
  });

  readonly hasInput = computed(() => !!this.form.controls.password.value.length);

  readonly allPassed = computed(
    () => this.hasInput() && this.passedCount() === this.totalCount() && this.totalCount() > 0
  );

  toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  clear(): void {
    this.form.controls.password.setValue('');
    this.showPassword.set(false);
  }

  copyInput(): void {
    this.copyText(this.form.controls.password.value, 'Password');
  }

  copyOutput(): void {
    const lines = this.rules().map((r) => `${r.passed ? '✓' : '✗'} ${r.label}: ${r.description}`);
    lines.unshift(`Strength: ${this.strengthLabel()}`);
    lines.unshift(`Rules: ${this.passedCount()}/${this.totalCount()} passed`);
    this.copyText(lines.join('\n'), 'Rule checklist');
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }
}

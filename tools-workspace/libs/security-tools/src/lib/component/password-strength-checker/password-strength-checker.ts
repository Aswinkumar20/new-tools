import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

type StrengthLevel = 'very-weak' | 'weak' | 'medium' | 'strong' | 'very-strong';

interface StrengthBreakdown {
  lengthScore: number;
  varietyScore: number;
  bonusScore: number;
}

type PasswordStrengthFormGroup = FormGroup<{
  password: FormControl<string>;
  showDetails: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-password-strength-checker',
  standalone: true,
  templateUrl: './password-strength-checker.html',
  styleUrls: ['./password-strength-checker.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PasswordStrengthCheckerComponent {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly form: PasswordStrengthFormGroup = this.fb.group({
    password: this.fb.control('', { nonNullable: true }),
    showDetails: this.fb.control(true, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);

  readonly hasPassword = computed(() => !!this.form.controls.password.value);

  readonly strengthBreakdown = computed<StrengthBreakdown>(() => {
    const pwd = this.form.controls.password.value;
    if (!pwd) {
      return { lengthScore: 0, varietyScore: 0, bonusScore: 0 };
    }

    let lengthScore = 0;
    if (pwd.length >= 8) lengthScore++;
    if (pwd.length >= 10) lengthScore++;
    if (pwd.length >= 12) lengthScore++;
    if (pwd.length >= 16) lengthScore++;
    if (pwd.length >= 20) lengthScore++;
    if (pwd.length >= 24) lengthScore++;

    let varietyScore = 0;
    if (/[a-z]/.test(pwd)) varietyScore++;
    if (/[A-Z]/.test(pwd)) varietyScore++;
    if (/[0-9]/.test(pwd)) varietyScore++;
    if (/[^A-Za-z0-9]/.test(pwd)) varietyScore++;

    let bonusScore = 0;
    if (!/(.)\1{2,}/.test(pwd)) {
      bonusScore++;
    }
    if (!/(1234|abcd|qwer|password|letmein)/i.test(pwd)) {
      bonusScore++;
    }

    return { lengthScore, varietyScore, bonusScore };
  });

  readonly strengthScore = computed(() => {
    const { lengthScore, varietyScore, bonusScore } = this.strengthBreakdown();
    return lengthScore + varietyScore + bonusScore;
  });

  readonly strengthLevel = computed<StrengthLevel>(() => {
    const score = this.strengthScore();
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
    const maxScore = 12;
    const score = Math.min(this.strengthScore(), maxScore);
    return (score / maxScore) * 100;
  });

  readonly suggestions = computed<string[]>(() => {
    const pwd = this.form.controls.password.value;
    const suggestions: string[] = [];

    if (!pwd) {
      suggestions.push('Start typing a password to see suggestions.');
      return suggestions;
    }

    if (pwd.length < 12) {
      suggestions.push('Use at least 12 characters for better security.');
    }
    if (!/[a-z]/.test(pwd)) {
      suggestions.push('Add lowercase letters (a–z).');
    }
    if (!/[A-Z]/.test(pwd)) {
      suggestions.push('Add uppercase letters (A–Z).');
    }
    if (!/[0-9]/.test(pwd)) {
      suggestions.push('Add numbers (0–9).');
    }
    if (!/[^A-Za-z0-9]/.test(pwd)) {
      suggestions.push('Add symbols (e.g. !@#$%^&*).');
    }
    if (/(.)\1{2,}/.test(pwd)) {
      suggestions.push('Avoid repeating the same character several times in a row.');
    }
    if (/(1234|abcd|qwer|password|letmein)/i.test(pwd)) {
      suggestions.push('Avoid obvious sequences or common passwords.');
    }

    if (suggestions.length === 0) {
      suggestions.push('This password looks strong. Consider using a password manager to store it safely.');
    }

    return suggestions;
  });

  clear(): void {
    this.form.controls.password.setValue('');
    this.errors.set([]);
  }

  copyPassword(): void {
    const pwd = this.form.controls.password.value;
    if (!pwd) return;
    navigator.clipboard.writeText(pwd).then(() => {
      alert('Password copied to clipboard!');
    });
  }
}

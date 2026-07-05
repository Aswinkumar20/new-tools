import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

type StrengthLevel = 'very-weak' | 'weak' | 'medium' | 'strong' | 'very-strong';

interface GeneratedPassword {
  value: string;
  createdAt: number;
}

type RandomPasswordFormGroup = FormGroup<{
  length: FormControl<number>;
  includeLowercase: FormControl<boolean>;
  includeUppercase: FormControl<boolean>;
  includeNumbers: FormControl<boolean>;
  includeSymbols: FormControl<boolean>;
  avoidAmbiguous: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-random-password-generator',
  standalone: true,
  templateUrl: './random-password-generator.html',
  styleUrls: ['./random-password-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RandomPasswordGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly form: RandomPasswordFormGroup = this.fb.group({
    length: this.fb.control(16, { nonNullable: true }),
    includeLowercase: this.fb.control(true, { nonNullable: true }),
    includeUppercase: this.fb.control(true, { nonNullable: true }),
    includeNumbers: this.fb.control(true, { nonNullable: true }),
    includeSymbols: this.fb.control(true, { nonNullable: true }),
    avoidAmbiguous: this.fb.control(true, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly password = signal<GeneratedPassword | null>(null);

  readonly hasPassword = computed(() => this.password() !== null);

  readonly passwordLength = computed(() => {
    const p = this.password();
    return p ? p.value.length : this.form.controls.length.value;
  });

  readonly strengthLevel = computed<StrengthLevel>(() => {
    const pwd = this.password()?.value ?? '';
    if (!pwd) return 'very-weak';
    const lengthScore = Math.min(pwd.length / 4, 4);
    let varietyScore = 0;
    if (/[a-z]/.test(pwd)) varietyScore++;
    if (/[A-Z]/.test(pwd)) varietyScore++;
    if (/[0-9]/.test(pwd)) varietyScore++;
    if (/[^A-Za-z0-9]/.test(pwd)) varietyScore++;
    const score = lengthScore + varietyScore;
    if (score >= 7) return 'very-strong';
    if (score >= 6) return 'strong';
    if (score >= 4) return 'medium';
    if (score >= 2) return 'weak';
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

  generatedTimeLabel(): string {
    const p = this.password();
    if (!p) return '—';
    return new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  generate(): void {
    this.errors.set([]);

    const { length, includeLowercase, includeUppercase, includeNumbers, includeSymbols, avoidAmbiguous } =
      this.form.getRawValue();

    if (!includeLowercase && !includeUppercase && !includeNumbers && !includeSymbols) {
      this.errors.set(['Select at least one character set to include.']);
      this.password.set(null);
      return;
    }

    if (length < 4 || length > 128) {
      this.errors.set(['Length should be between 4 and 128 characters.']);
      this.password.set(null);
      return;
    }

    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()-_=+[]{};:,.<>/?';
    const ambiguous = 'O0l1I';

    let charset = '';
    if (includeLowercase) charset += lowercase;
    if (includeUppercase) charset += uppercase;
    if (includeNumbers) charset += numbers;
    if (includeSymbols) charset += symbols;

    if (avoidAmbiguous) {
      charset = charset
        .split('')
        .filter((c) => !ambiguous.includes(c))
        .join('');
    }

    if (!charset) {
      this.errors.set(['Character set is empty. Relax constraints or include more types.']);
      this.password.set(null);
      return;
    }

    const chars = charset.split('');
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);

    let pwd = '';
    for (let i = 0; i < length; i++) {
      const index = randomValues[i] % chars.length;
      pwd += chars[index];
    }

    this.password.set({
      value: pwd,
      createdAt: Date.now()
    });
  }

  copyToClipboard(): void {
    const value = this.password()?.value;
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      alert('Password copied to clipboard!');
    }).catch(() => {
      this.errors.set(['Failed to copy password to clipboard.']);
    });
  }

  clear(): void {
    this.password.set(null);
    this.errors.set([]);
  }

  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }
}

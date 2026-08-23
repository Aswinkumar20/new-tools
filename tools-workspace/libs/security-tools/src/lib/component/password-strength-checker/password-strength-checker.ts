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
  PASSWORD_STRENGTH_DEFAULT_FORM,
  PASSWORD_STRENGTH_RELATED_TOOLS
} from '../../constants/password-strength-checker.constants';
import type {
  PasswordStrengthFormGroup,
  PasswordStrengthFormValues
} from '../../types/password-strength-checker.types';
import {
  analyzePasswordStrength,
  resolvePasswordStrengthSuggestion
} from '../../utils/password-strength-checker.utils';

@Component({
  selector: 'lib-password-strength-checker',
  standalone: true,
  templateUrl: './password-strength-checker.html',
  styleUrls: ['./password-strength-checker.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PasswordStrengthCheckerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly relatedTools: ReadonlyArray<StRelatedToolLink> = PASSWORD_STRENGTH_RELATED_TOOLS;

  readonly form: PasswordStrengthFormGroup = this.fb.group({
    password: this.fb.control(PASSWORD_STRENGTH_DEFAULT_FORM.password, { nonNullable: true }),
    showDetails: this.fb.control(PASSWORD_STRENGTH_DEFAULT_FORM.showDetails, {
      nonNullable: true
    })
  });

  readonly errors = signal<string[]>([]);
  readonly formSnapshot = signal<PasswordStrengthFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  private readonly analysis = computed(() =>
    analyzePasswordStrength(this.formSnapshot().password)
  );

  readonly hasPassword = computed(() => !!this.formSnapshot().password);

  readonly strengthBreakdown = computed(() => this.analysis().breakdown);
  readonly strengthScore = computed(() => this.analysis().score);
  readonly strengthLevel = computed(() => this.analysis().level);
  readonly strengthLabel = computed(() => this.analysis().label);
  readonly strengthPercent = computed(() => this.analysis().percent);

  /** In-panel improvement tips (existing UX). */
  readonly suggestions = computed(() => this.analysis().tips);

  readonly showDetails = computed(() => this.formSnapshot().showDetails);

  readonly primarySuggestion = computed(() => {
    const current = this.analysis();
    const suggestion = resolvePasswordStrengthSuggestion({
      hasPassword: this.hasPassword(),
      level: current.level,
      score: current.score
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

  clear(): void {
    this.form.controls.password.setValue('');
    this.errors.set([]);
    this.dismissedSuggestionId.set(null);
    this.toast.info('Password cleared');
  }

  async copyPassword(): Promise<void> {
    const pwd = this.form.controls.password.value;
    if (!pwd) {
      return;
    }
    await stCopyText(this.toast, pwd, 'Password');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private readFormValues(): PasswordStrengthFormValues {
    const raw = this.form.getRawValue();
    return {
      password: raw.password,
      showDetails: raw.showDetails
    };
  }
}

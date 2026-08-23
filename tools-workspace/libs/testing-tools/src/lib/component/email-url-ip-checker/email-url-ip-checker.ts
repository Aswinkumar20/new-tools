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
  EMAIL_URL_IP_DEFAULT_FORM,
  EMAIL_URL_IP_RELATED_TOOLS
} from '../../constants/email-url-ip-checker.constants';
import type {
  EmailUrlIpAnalysisResult,
  EmailUrlIpCheckMode,
  EmailUrlIpFormGroup,
  EmailUrlIpFormValues
} from '../../types/email-url-ip-checker.types';
import {
  analyzeEmailUrlIpValues,
  buildEmailUrlIpResultsSummary,
  countEmailUrlIpTypes,
  formatEmailUrlIpInfoValue,
  getEmailUrlIpInfoKeys,
  resolveEmailUrlIpModeLabel,
  resolveEmailUrlIpSuggestion
} from '../../utils/email-url-ip-checker.utils';

@Component({
  selector: 'lib-email-url-ip-checker',
  standalone: true,
  templateUrl: './email-url-ip-checker.html',
  styleUrls: ['./email-url-ip-checker.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmailUrlIpCheckerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly relatedTools: ReadonlyArray<TtRelatedToolLink> = EMAIL_URL_IP_RELATED_TOOLS;

  readonly form: EmailUrlIpFormGroup = this.fb.group({
    input: this.fb.control(EMAIL_URL_IP_DEFAULT_FORM.input, { nonNullable: true }),
    mode: this.fb.control<EmailUrlIpCheckMode>(EMAIL_URL_IP_DEFAULT_FORM.mode, {
      nonNullable: true
    }),
    allowMultiple: this.fb.control(EMAIL_URL_IP_DEFAULT_FORM.allowMultiple, {
      nonNullable: true
    }),
    ignoreEmpty: this.fb.control(EMAIL_URL_IP_DEFAULT_FORM.ignoreEmpty, {
      nonNullable: true
    })
  });

  readonly results = signal<EmailUrlIpAnalysisResult[]>([]);
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly formSnapshot = signal<EmailUrlIpFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasResults = computed(() => this.results().length > 0);
  readonly totalCount = computed(() => this.results().length);
  readonly validCount = computed(() => this.results().filter((r) => r.valid).length);
  readonly invalidCount = computed(() => this.totalCount() - this.validCount());

  readonly typeCounts = computed(() => countEmailUrlIpTypes(this.results()));

  readonly hasInput = computed(() => !!this.formSnapshot().input.trim());

  readonly modeLabel = computed(() => resolveEmailUrlIpModeLabel(this.formSnapshot().mode));

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveEmailUrlIpSuggestion({
      hasInput: this.hasInput(),
      hasResults: this.hasResults(),
      validCount: this.validCount(),
      invalidCount: this.invalidCount(),
      typeCounts: this.typeCounts(),
      results: this.results(),
      errorMessage: this.errors()[0] ?? null
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

  onInputChange(): void {
    this.formSnapshot.set(this.readFormValues());
    if (this.hasInput()) {
      this.analyze();
    } else {
      this.results.set([]);
      this.errors.set([]);
    }
  }

  onOptionChange(): void {
    this.formSnapshot.set(this.readFormValues());
    if (this.hasInput()) {
      this.analyze();
    }
  }

  clear(): void {
    this.form.controls.input.setValue('');
    this.results.set([]);
    this.errors.set([]);
    this.warnings.set([]);
    this.dismissedSuggestionId.set(null);
    this.toast.info('Cleared');
  }

  async copyInput(): Promise<void> {
    await ttCopyText(this.toast, this.form.controls.input.value, 'Input');
  }

  async copyOutput(): Promise<void> {
    await ttCopyText(this.toast, buildEmailUrlIpResultsSummary(this.results()), 'Results');
  }

  analyze(): void {
    this.dismissedSuggestionId.set(null);
    const { results, errors } = analyzeEmailUrlIpValues(this.form.getRawValue());
    this.errors.set(errors);
    this.warnings.set([]);
    this.results.set(results);
  }

  formatInfoValue(value: string | number | boolean | null): string {
    return formatEmailUrlIpInfoValue(value);
  }

  infoKeys(info: Record<string, string | number | boolean | null>): string[] {
    return getEmailUrlIpInfoKeys(info);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private readFormValues(): EmailUrlIpFormValues {
    return this.form.getRawValue();
  }
}

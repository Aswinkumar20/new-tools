import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { buCopyText } from '../../shared/bu-clipboard.util';
import { buDownloadJson, buDownloadTimestamp } from '../../shared/bu-download.util';
import {
  SPEED_TEST_DEFAULT_FORM_VALUES,
  SPEED_TEST_MAX_RUNS,
  SPEED_TEST_RELATED_TOOLS,
  SPEED_TEST_RESULT_LIMIT
} from '../../constants/network-speed-test.constants';
import type { BuRelatedToolLink, BuToolSuggestion } from '../../shared/bu-tool-suggestion.model';
import type { SpeedTestResult } from '../../types/network-speed-test.types';
import {
  averageMbps,
  formatAllSpeedTestResults,
  formatSpeedBytes,
  formatSpeedDurationMs,
  formatSpeedMbps,
  formatSpeedTimestamp,
  measureDownloadSpeed,
  mergeSpeedTestResults,
  resolveSpeedTestSuggestion,
  validateSpeedTestConfig
} from '../../utils/network-speed-test.utils';

type SpeedTestFormGroup = FormGroup<{
  url: FormControl<string>;
  sizeBytes: FormControl<number>;
  runs: FormControl<number>;
}>;

@Component({
  selector: 'lib-network-speed-test',
  standalone: true,
  templateUrl: './network-speed-test.html',
  styleUrls: ['./network-speed-test.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NetworkSpeedTestComponent {
  private readonly formBuilder = inject(FormBuilder);
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  readonly maxRuns = SPEED_TEST_MAX_RUNS;
  readonly resultLimit = SPEED_TEST_RESULT_LIMIT;
  readonly relatedTools: ReadonlyArray<BuRelatedToolLink> = SPEED_TEST_RELATED_TOOLS;

  readonly formatMbps = formatSpeedMbps;
  readonly formatMs = formatSpeedDurationMs;
  readonly formatTimestamp = formatSpeedTimestamp;
  readonly formatBytes = formatSpeedBytes;

  readonly form: SpeedTestFormGroup = this.formBuilder.group({
    url: this.formBuilder.control(SPEED_TEST_DEFAULT_FORM_VALUES.url, { nonNullable: true }),
    sizeBytes: this.formBuilder.control(SPEED_TEST_DEFAULT_FORM_VALUES.sizeBytes, {
      nonNullable: true
    }),
    runs: this.formBuilder.control(SPEED_TEST_DEFAULT_FORM_VALUES.runs, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly isRunning = signal(false);
  readonly results = signal<SpeedTestResult[]>([]);
  readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasResults = computed(() => this.results().length > 0);
  readonly lastResult = computed(() => (this.results().length ? this.results()[0] : null));
  readonly avgMbps = computed(() => averageMbps(this.results()));

  readonly primarySuggestion = computed<BuToolSuggestion | null>(() => {
    const latestError = this.errors()[0] ?? this.lastResult()?.error ?? null;
    const suggestion = resolveSpeedTestSuggestion(
      this.isRunning(),
      this.results(),
      latestError
    );
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  async runTest(): Promise<void> {
    this.errors.set([]);

    const values = this.form.getRawValue();
    const validationError = validateSpeedTestConfig(values);
    if (validationError) {
      this.errors.set([validationError]);
      return;
    }

    this.isRunning.set(true);
    const newResults: SpeedTestResult[] = [];

    try {
      for (let runIndex = 0; runIndex < values.runs; runIndex++) {
        const result = await measureDownloadSpeed(values.url.trim(), values.sizeBytes);
        newResults.unshift(result);

        if (result.error) {
          this.errors.set([`Run ${runIndex + 1} failed: ${result.error}`]);
          break;
        }
      }

      if (newResults.length) {
        this.results.set(mergeSpeedTestResults(newResults, this.results()));
        const hadError = newResults.some((result) => !!result.error);
        if (!hadError) {
          this.toast.success(
            newResults.length === 1 ? 'Speed test complete' : `${newResults.length} runs complete`
          );
        }
      }
    } finally {
      this.isRunning.set(false);
    }
  }

  clearResults(): void {
    this.results.set([]);
    this.errors.set([]);
    this.toast.info('Results cleared');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  copyResults(): void {
    buCopyText(this.toast, formatAllSpeedTestResults(this.results()), 'Speed test results');
  }

  downloadResults(): void {
    if (!this.results().length) return;

    try {
      buDownloadJson(this.results(), `network-speed-results-${buDownloadTimestamp()}.json`);
      this.toast.success('Results downloaded');
    } catch {
      this.toast.error('Failed to download results');
    }
  }
}

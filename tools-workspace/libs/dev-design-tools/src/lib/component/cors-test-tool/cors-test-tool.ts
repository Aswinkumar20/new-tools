import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import type { DdRelatedToolLink } from '../../shared/dd-tool-suggestion.model';
import {
  CORS_HTTP_METHODS,
  CORS_TEST_DEFAULT_ACCEPT,
  CORS_TEST_DEFAULT_METHOD,
  CORS_TEST_DEFAULT_URL,
  CORS_TEST_RELATED_TOOLS,
  CORS_URL_PATTERN
} from '../../constants/cors-test-tool.constants';
import type {
  CorsHistoryEntry,
  CorsTestResult
} from '../../types/cors-test-tool.types';
import {
  buildCorsAnalysisNotes,
  corsHeadersToList,
  executeCorsRequest,
  formatDuration,
  formatJson,
  formatRelativeTimestamp,
  hasHeaderEntries,
  headersToList,
  prependCorsHistory,
  resolveCorsTestSuggestion,
  tryParseJson
} from '../../utils/cors-test-tool.utils';

type CorsHeaderFormGroup = FormGroup<{
  key: FormControl<string>;
  value: FormControl<string>;
}>;

type CorsTestFormGroup = FormGroup<{
  url: FormControl<string>;
  method: FormControl<string>;
  headers: FormArray<CorsHeaderFormGroup>;
  body: FormControl<string>;
  rememberHistory: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-cors-test-tool',
  standalone: true,
  templateUrl: './cors-test-tool.html',
  styleUrls: ['./cors-test-tool.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CorsTestToolComponent {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly form: CorsTestFormGroup = this.fb.group({
    url: this.fb.control(CORS_TEST_DEFAULT_URL, {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(CORS_URL_PATTERN)]
    }),
    method: this.fb.control(CORS_TEST_DEFAULT_METHOD, { nonNullable: true }),
    headers: this.fb.array<CorsHeaderFormGroup>([
      this.createHeader('Accept', CORS_TEST_DEFAULT_ACCEPT)
    ]),
    body: this.fb.control('', { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly methods = CORS_HTTP_METHODS;
  readonly relatedTools: ReadonlyArray<DdRelatedToolLink> = CORS_TEST_RELATED_TOOLS;
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly result = signal<CorsTestResult | null>(null);
  readonly history = signal<CorsHistoryEntry[]>([]);
  readonly isTesting = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly headersFormArray = computed(() => this.form.controls.headers);
  readonly primarySuggestion = computed(() => {
    const suggestion = resolveCorsTestSuggestion({
      result: this.result(),
      requestHeaders: this.form.controls.headers.getRawValue()
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  get headers(): FormArray<CorsHeaderFormGroup> {
    return this.form.controls.headers;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  addHeader(): void {
    this.headers.push(this.createHeader());
  }

  removeHeader(index: number): void {
    if (this.headers.length > 1) {
      this.headers.removeAt(index);
    }
  }

  async testCors(): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);
    this.dismissedSuggestionId.set(null);
    this.isTesting.set(true);

    const { url, method, headers, body } = this.form.getRawValue();

    if (!url || !this.form.controls.url.valid) {
      this.errors.set(['Please enter a valid URL starting with http:// or https://']);
      this.isTesting.set(false);
      return;
    }

    const result = await executeCorsRequest({ url, method, headers, body });
    this.result.set(result);

    if (result.status === null && result.error) {
      this.errors.set([`Request failed: ${result.error}`]);
      if (result.error.includes('CORS') || result.error.includes('Access-Control')) {
        this.warnings.set([
          'This appears to be a CORS error. The server may not allow requests from this origin.'
        ]);
      }
    } else {
      const origin = typeof location !== 'undefined' ? location.origin : '';
      this.warnings.set(buildCorsAnalysisNotes(result.corsHeaders, origin));
    }

    if (this.form.controls.rememberHistory.value) {
      this.addToHistory(url, method, result);
    }

    this.isTesting.set(false);
  }

  clear(): void {
    this.dismissedSuggestionId.set(null);
    this.form.patchValue({
      url: CORS_TEST_DEFAULT_URL,
      method: CORS_TEST_DEFAULT_METHOD,
      body: ''
    });
    while (this.headers.length > 1) {
      this.headers.removeAt(1);
    }
    this.headers.at(0)?.patchValue({ key: 'Accept', value: CORS_TEST_DEFAULT_ACCEPT });
    this.result.set(null);
    this.errors.set([]);
    this.warnings.set([]);
  }

  applyHistory(entry: CorsHistoryEntry): void {
    this.form.patchValue({
      url: entry.url,
      method: entry.method
    });
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  formatTimestamp(timestamp: number): string {
    return formatRelativeTimestamp(timestamp);
  }

  formatDuration(ms: number): string {
    return formatDuration(ms);
  }

  tryParseJson(text: string | null): unknown {
    return tryParseJson(text);
  }

  formatJson(obj: unknown): string {
    return formatJson(obj);
  }

  getCorsHeadersList(headers: Record<string, string>) {
    return corsHeadersToList(headers);
  }

  getHeadersList(headers: Record<string, string>) {
    return headersToList(headers);
  }

  hasHeaders(headers: Record<string, string>): boolean {
    return hasHeaderEntries(headers);
  }

  private createHeader(key = '', value = ''): CorsHeaderFormGroup {
    return this.fb.group({
      key: this.fb.control(key, { nonNullable: true }),
      value: this.fb.control(value, { nonNullable: true })
    });
  }

  private addToHistory(url: string, method: string, result: CorsTestResult): void {
    const entry: CorsHistoryEntry = {
      timestamp: result.timestamp,
      url,
      method,
      success: result.success,
      status: result.status,
      corsHeaders: result.corsHeaders
    };

    this.history.update((entries) => prependCorsHistory(entries, entry));
  }
}

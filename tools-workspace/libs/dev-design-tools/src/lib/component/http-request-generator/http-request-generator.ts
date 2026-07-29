import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ddCopyText } from '../../shared/dd-clipboard.util';
import type { DdRelatedToolLink } from '../../shared/dd-tool-suggestion.model';
import {
  HTTP_REQUEST_CODE_FORMATS,
  HTTP_REQUEST_DEFAULT_CONTENT_TYPE,
  HTTP_REQUEST_DEFAULT_FORMAT,
  HTTP_REQUEST_DEFAULT_METHOD,
  HTTP_REQUEST_DEFAULT_URL,
  HTTP_REQUEST_METHODS,
  HTTP_REQUEST_RELATED_TOOLS,
  HTTP_REQUEST_URL_PATTERN
} from '../../constants/http-request-generator.constants';
import type { HttpRequestHistoryEntry } from '../../types/http-request-generator.types';
import {
  formatRelativeTimestamp,
  generateHttpRequestCode,
  getCodeFormatLabel,
  prependHttpRequestHistory,
  resolveHttpRequestSuggestion,
  validateHttpRequestUrl
} from '../../utils/http-request-generator.utils';

type HeaderFormGroup = FormGroup<{
  key: FormControl<string>;
  value: FormControl<string>;
}>;

type RequestGeneratorFormGroup = FormGroup<{
  url: FormControl<string>;
  method: FormControl<string>;
  headers: FormArray<HeaderFormGroup>;
  body: FormControl<string>;
  codeFormat: FormControl<string>;
  rememberHistory: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-http-request-generator',
  standalone: true,
  templateUrl: './http-request-generator.html',
  styleUrls: ['./http-request-generator.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HttpRequestGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly form: RequestGeneratorFormGroup = this.fb.group({
    url: this.fb.control(HTTP_REQUEST_DEFAULT_URL, {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(HTTP_REQUEST_URL_PATTERN)]
    }),
    method: this.fb.control(HTTP_REQUEST_DEFAULT_METHOD, { nonNullable: true }),
    headers: this.fb.array<HeaderFormGroup>([
      this.createHeader('Content-Type', HTTP_REQUEST_DEFAULT_CONTENT_TYPE)
    ]),
    body: this.fb.control('', { nonNullable: true }),
    codeFormat: this.fb.control(HTTP_REQUEST_DEFAULT_FORMAT, { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly methods = HTTP_REQUEST_METHODS;
  readonly codeFormats = HTTP_REQUEST_CODE_FORMATS;
  readonly relatedTools: ReadonlyArray<DdRelatedToolLink> = HTTP_REQUEST_RELATED_TOOLS;
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly history = signal<HttpRequestHistoryEntry[]>([]);
  readonly generatedCode = signal('');
  private readonly formTick = signal(0);
  private readonly hasCopiedCode = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly headersFormArray = computed(() => this.form.controls.headers);
  readonly currentFormatLabel = computed(() => {
    this.formTick();
    return getCodeFormatLabel(this.form.controls.codeFormat.value);
  });
  readonly primarySuggestion = computed(() => {
    this.formTick();
    const { url, method, headers, body } = this.form.getRawValue();
    const suggestion = resolveHttpRequestSuggestion({
      url,
      method,
      headers,
      body,
      hasCopiedCode: this.hasCopiedCode()
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.refreshGeneratedCode();
    this.form.valueChanges
      .pipe(debounceTime(150), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.dismissedSuggestionId.set(null);
        this.refreshGeneratedCode();
        this.updateHistory();
      });
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  get headers(): FormArray<HeaderFormGroup> {
    return this.form.controls.headers;
  }

  addHeader(): void {
    this.headers.push(this.createHeader());
  }

  removeHeader(index: number): void {
    if (this.headers.length > 1) {
      this.headers.removeAt(index);
    }
  }

  async copyToClipboard(text: string, label: string): Promise<void> {
    const ok = await ddCopyText(this.toast, text, label);
    if (ok) {
      this.hasCopiedCode.set(true);
      this.errors.set([]);
    } else {
      this.errors.set([`Unable to copy ${label} to clipboard.`]);
    }
  }

  clear(): void {
    this.hasCopiedCode.set(false);
    this.dismissedSuggestionId.set(null);
    this.form.patchValue({
      url: HTTP_REQUEST_DEFAULT_URL,
      method: HTTP_REQUEST_DEFAULT_METHOD,
      body: ''
    });
    while (this.headers.length > 1) {
      this.headers.removeAt(1);
    }
    this.headers.at(0)?.patchValue({ key: 'Content-Type', value: HTTP_REQUEST_DEFAULT_CONTENT_TYPE });
    this.errors.set([]);
    this.warnings.set([]);
  }

  applyHistory(entry: HttpRequestHistoryEntry): void {
    this.form.patchValue({
      url: entry.url,
      method: entry.method,
      codeFormat: entry.codeFormat
    });
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  getFormatLabel(value: string): string {
    return getCodeFormatLabel(value);
  }

  formatTimestamp(timestamp: number): string {
    return formatRelativeTimestamp(timestamp);
  }

  private createHeader(key = '', value = ''): HeaderFormGroup {
    return this.fb.group({
      key: this.fb.control(key, { nonNullable: true }),
      value: this.fb.control(value, { nonNullable: true })
    });
  }

  private refreshGeneratedCode(): void {
    this.formTick.update((n) => n + 1);
    this.errors.set([]);
    this.warnings.set([]);

    const url = this.form.controls.url.value?.trim() ?? '';
    const urlError = validateHttpRequestUrl(url);
    if (urlError === 'URL is required.') {
      this.errors.set([urlError]);
      this.generatedCode.set('');
      return;
    }
    if (urlError) {
      this.errors.set([urlError]);
      this.generatedCode.set(this.buildGeneratedCode());
      return;
    }

    try {
      this.generatedCode.set(this.buildGeneratedCode());
    } catch (error) {
      this.errors.set([error instanceof Error ? error.message : 'Failed to generate code.']);
      this.generatedCode.set('');
    }
  }

  private buildGeneratedCode(): string {
    const { url, method, headers, body, codeFormat } = this.form.getRawValue();
    return generateHttpRequestCode({ url, method, headers, body, codeFormat });
  }

  private updateHistory(): void {
    if (!this.form.controls.rememberHistory.value) {
      return;
    }

    const { url, method, codeFormat } = this.form.getRawValue();
    const entry: HttpRequestHistoryEntry = {
      timestamp: Date.now(),
      url,
      method,
      codeFormat
    };

    this.history.update((entries) => prependHttpRequestHistory(entries, entry));
  }
}

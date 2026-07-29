import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { ddCopyText } from '../../shared/dd-clipboard.util';
import type { DdRelatedToolLink } from '../../shared/dd-tool-suggestion.model';
import {
  POSTMAN_DEFAULT_ACCEPT,
  POSTMAN_DEFAULT_METHOD,
  POSTMAN_DEFAULT_URL,
  POSTMAN_HTTP_METHODS,
  POSTMAN_RELATED_TOOLS,
  POSTMAN_URL_PATTERN
} from '../../constants/postman-lite.constants';
import type {
  PostmanHistoryEntry,
  PostmanRequestResult,
  PostmanSavedRequest
} from '../../types/postman-lite.types';
import {
  executePostmanRequest,
  formatBytes,
  formatDuration,
  formatJson,
  formatRelativeTimestamp,
  hasHeaderEntries,
  headersToList,
  loadSavedRequestsFromStorage,
  persistSavedRequests,
  prependPostmanHistory,
  prependSavedRequest,
  resolvePostmanSuggestion,
  resolveSavedRequestName,
  tryParseJson,
  validateJsonBodyIfNeeded
} from '../../utils/postman-lite.utils';

type HeaderFormGroup = FormGroup<{
  key: FormControl<string>;
  value: FormControl<string>;
}>;

type PostmanLiteFormGroup = FormGroup<{
  url: FormControl<string>;
  method: FormControl<string>;
  headers: FormArray<HeaderFormGroup>;
  body: FormControl<string>;
  requestName: FormControl<string>;
  rememberHistory: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-postman-lite',
  standalone: true,
  templateUrl: './postman-lite.html',
  styleUrls: ['./postman-lite.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PostmanLiteComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly form: PostmanLiteFormGroup = this.fb.group({
    url: this.fb.control(POSTMAN_DEFAULT_URL, {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(POSTMAN_URL_PATTERN)]
    }),
    method: this.fb.control(POSTMAN_DEFAULT_METHOD, { nonNullable: true }),
    headers: this.fb.array<HeaderFormGroup>([
      this.createHeader('Accept', POSTMAN_DEFAULT_ACCEPT)
    ]),
    body: this.fb.control('', { nonNullable: true }),
    requestName: this.fb.control('', { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly methods = POSTMAN_HTTP_METHODS;
  readonly relatedTools: ReadonlyArray<DdRelatedToolLink> = POSTMAN_RELATED_TOOLS;
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly result = signal<PostmanRequestResult | null>(null);
  readonly history = signal<PostmanHistoryEntry[]>([]);
  readonly savedRequests = signal<PostmanSavedRequest[]>([]);
  readonly isSending = signal(false);
  private readonly jsonBodyError = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly hasSavedRequests = computed(() => this.savedRequests().length > 0);
  readonly headersFormArray = computed(() => this.form.controls.headers);
  readonly primarySuggestion = computed(() => {
    const suggestion = resolvePostmanSuggestion({
      result: this.result(),
      requestHeaders: this.form.controls.headers.getRawValue(),
      requestBody: this.form.controls.body.value,
      jsonBodyError: this.jsonBodyError()
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.savedRequests.set(loadSavedRequestsFromStorage());
  }

  get headers(): FormArray<HeaderFormGroup> {
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

  async sendRequest(): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);
    this.jsonBodyError.set(false);
    this.dismissedSuggestionId.set(null);
    this.isSending.set(true);

    const { url, method, headers, body } = this.form.getRawValue();

    if (!url || !this.form.controls.url.valid) {
      this.errors.set(['Please enter a valid URL starting with http:// or https://']);
      this.isSending.set(false);
      return;
    }

    const jsonError = validateJsonBodyIfNeeded(headers, body);
    if (jsonError) {
      this.errors.set([jsonError]);
      this.jsonBodyError.set(true);
      this.isSending.set(false);
      return;
    }

    const result = await executePostmanRequest({ url, method, headers, body });
    this.result.set(result);

    if (!result.success && result.status === null && result.error) {
      this.errors.set([`Request failed: ${result.error}`]);
    }

    if (this.form.controls.rememberHistory.value) {
      this.addToHistory(url, method, result);
    }

    this.isSending.set(false);
  }

  saveRequest(): void {
    const { url, method, headers, body, requestName } = this.form.getRawValue();
    const name = resolveSavedRequestName(requestName);

    const request: PostmanSavedRequest = {
      id: Date.now().toString(),
      name,
      url,
      method,
      headers: headers.filter((header) => header.key && header.value),
      body,
      timestamp: Date.now()
    };

    this.savedRequests.update((requests) => prependSavedRequest(requests, request));
    persistSavedRequests(this.savedRequests());
    this.form.controls.requestName.setValue('');
    this.toast.info(`Saved "${name}"`);
  }

  loadRequest(request: PostmanSavedRequest): void {
    this.form.patchValue({
      url: request.url,
      method: request.method,
      body: request.body,
      requestName: request.name
    });

    while (this.headers.length > 0) {
      this.headers.removeAt(0);
    }

    if (request.headers.length > 0) {
      for (const header of request.headers) {
        this.headers.push(this.createHeader(header.key, header.value));
      }
    } else {
      this.headers.push(this.createHeader());
    }
  }

  deleteRequest(id: string): void {
    this.savedRequests.update((requests) => requests.filter((request) => request.id !== id));
    persistSavedRequests(this.savedRequests());
  }

  clearSavedRequests(): void {
    this.savedRequests.set([]);
    persistSavedRequests([]);
  }

  async copyToClipboard(text: string, label: string): Promise<void> {
    const ok = await ddCopyText(this.toast, text, label);
    if (!ok) {
      this.errors.set([`Unable to copy ${label} to clipboard.`]);
    } else {
      this.errors.set([]);
    }
  }

  clear(): void {
    this.dismissedSuggestionId.set(null);
    this.jsonBodyError.set(false);
    this.form.patchValue({
      url: POSTMAN_DEFAULT_URL,
      method: POSTMAN_DEFAULT_METHOD,
      body: '',
      requestName: ''
    });
    while (this.headers.length > 1) {
      this.headers.removeAt(1);
    }
    this.headers.at(0)?.patchValue({ key: 'Accept', value: POSTMAN_DEFAULT_ACCEPT });
    this.result.set(null);
    this.errors.set([]);
    this.warnings.set([]);
  }

  applyHistory(entry: PostmanHistoryEntry): void {
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

  tryParseJson(text: string | null): unknown {
    return tryParseJson(text);
  }

  formatJson(obj: unknown): string {
    return formatJson(obj);
  }

  formatTimestamp(timestamp: number): string {
    return formatRelativeTimestamp(timestamp);
  }

  formatDuration(ms: number): string {
    return formatDuration(ms);
  }

  getHeadersList(headers: Record<string, string>) {
    return headersToList(headers);
  }

  hasHeaders(headers: Record<string, string>): boolean {
    return hasHeaderEntries(headers);
  }

  formatBytes(bytes: number): string {
    return formatBytes(bytes);
  }

  private createHeader(key = '', value = ''): HeaderFormGroup {
    return this.fb.group({
      key: this.fb.control(key, { nonNullable: true }),
      value: this.fb.control(value, { nonNullable: true })
    });
  }

  private addToHistory(url: string, method: string, result: PostmanRequestResult): void {
    const entry: PostmanHistoryEntry = {
      timestamp: result.timestamp,
      url,
      method,
      status: result.status,
      success: result.success
    };

    this.history.update((entries) => prependPostmanHistory(entries, entry));
  }
}

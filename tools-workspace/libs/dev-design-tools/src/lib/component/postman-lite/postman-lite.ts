import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface RequestResult {
  success: boolean;
  status: number | null;
  statusText: string;
  headers: Record<string, string>;
  body: string | null;
  error: string | null;
  timestamp: number;
  duration: number;
}

interface SavedRequest {
  id: string;
  name: string;
  url: string;
  method: string;
  headers: Array<{ key: string; value: string }>;
  body: string;
  timestamp: number;
}

interface HistoryEntry {
  timestamp: number;
  url: string;
  method: string;
  status: number | null;
  success: boolean;
}

type PostmanLiteFormGroup = FormGroup<{
  url: FormControl<string>;
  method: FormControl<string>;
  headers: FormArray<FormGroup<{ key: FormControl<string>; value: FormControl<string> }>>;
  body: FormControl<string>;
  rememberHistory: FormControl<boolean>;
}>;

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

@Component({
  selector: 'lib-postman-lite',
  standalone: true,
  templateUrl: './postman-lite.html',
  styleUrls: ['./postman-lite.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PostmanLiteComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly form: PostmanLiteFormGroup = this.fb.group({
    url: this.fb.control('https://api.github.com/users/octocat', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^https?:\/\/.+/)]
    }),
    method: this.fb.control('GET', { nonNullable: true }),
    headers: this.fb.array<FormGroup<{ key: FormControl<string>; value: FormControl<string> }>>([
      this.createHeader('Accept', 'application/json')
    ]),
    body: this.fb.control('', { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly methods = HTTP_METHODS;
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly result = signal<RequestResult | null>(null);
  readonly history = signal<HistoryEntry[]>([]);
  readonly savedRequests = signal<SavedRequest[]>([]);
  readonly isSending = signal(false);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly hasSavedRequests = computed(() => this.savedRequests().length > 0);
  readonly headersFormArray = computed(() => this.form.controls.headers);
  readonly Object = Object;

  constructor() {
    this.loadSavedRequests();
  }

  get headers(): FormArray<FormGroup<{ key: FormControl<string>; value: FormControl<string> }>> {
    return this.form.controls.headers;
  }

  private createHeader(key: string = '', value: string = ''): FormGroup<{ key: FormControl<string>; value: FormControl<string> }> {
    return this.fb.group({
      key: this.fb.control(key, { nonNullable: true }),
      value: this.fb.control(value, { nonNullable: true })
    });
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
    this.isSending.set(true);

    const { url, method, headers, body } = this.form.getRawValue();

    if (!url || !this.form.controls.url.valid) {
      this.errors.set(['Please enter a valid URL starting with http:// or https://']);
      this.isSending.set(false);
      return;
    }

    const startTime = Date.now();

    try {
      // Build headers object
      const httpHeaders: Record<string, string> = {};
      for (const header of headers) {
        if (header.key && header.value) {
          httpHeaders[header.key] = header.value;
        }
      }

      // Make the request using fetch API
      const fetchOptions: RequestInit = {
        method,
        headers: httpHeaders,
        mode: 'cors',
        cache: 'no-cache'
      };

      if (body && !['GET', 'HEAD'].includes(method)) {
        fetchOptions.body = body;
      }

      // Soft-validate JSON body when Content-Type claims JSON
      const contentTypeHeader = Object.entries(httpHeaders).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '';
      if (body && contentTypeHeader.includes('json')) {
        try {
          JSON.parse(body);
        } catch {
          this.errors.set(['Request body is not valid JSON.']);
          this.isSending.set(false);
          return;
        }
      }

      const response = await fetch(url, fetchOptions);
      const duration = Date.now() - startTime;

      // Extract all headers
      const allHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        allHeaders[key] = value;
      });

      let responseBody: string | null = null;
      const contentType = response.headers.get('content-type') || '';

      try {
        if (contentType.includes('application/json')) {
          const json = await response.json();
          responseBody = JSON.stringify(json, null, 2);
        } else {
          responseBody = await response.text();
        }
      } catch {
        responseBody = null;
      }

      const result: RequestResult = {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: allHeaders,
        body: responseBody,
        error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
        timestamp: Date.now(),
        duration
      };

      this.result.set(result);

      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(url, method, result);
      }
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      const result: RequestResult = {
        success: false,
        status: null,
        statusText: '',
        headers: {},
        body: null,
        error: errorMessage,
        timestamp: Date.now(),
        duration
      };

      this.result.set(result);
      this.errors.set([`Request failed: ${errorMessage}`]);

      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(url, method, result);
      }
    } finally {
      this.isSending.set(false);
    }
  }

  saveRequest(): void {
    const { url, method, headers, body } = this.form.getRawValue();
    const name = prompt('Enter a name for this request:') || `Request ${Date.now()}`;

    if (!name.trim()) {
      return;
    }

    const request: SavedRequest = {
      id: Date.now().toString(),
      name: name.trim(),
      url,
      method,
      headers: headers.filter((h) => h.key && h.value),
      body,
      timestamp: Date.now()
    };

    this.savedRequests.update((requests) => {
      const exists = requests.find((r) => r.id === request.id);
      if (exists) {
        return requests.map((r) => (r.id === request.id ? request : r));
      }
      return [request, ...requests].slice(0, 20);
    });

    this.saveToLocalStorage();
  }

  loadRequest(request: SavedRequest): void {
    this.form.patchValue({
      url: request.url,
      method: request.method,
      body: request.body
    });

    // Clear and add headers
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
    this.savedRequests.update((requests) => requests.filter((r) => r.id !== id));
    this.saveToLocalStorage();
  }

  clearSavedRequests(): void {
    this.savedRequests.set([]);
    this.saveToLocalStorage();
  }

  copyToClipboard(text: string, label: string): void {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Success
      })
      .catch(() => {
        this.errors.set([`Unable to copy ${label} to clipboard.`]);
      });
  }

  clear(): void {
    this.form.patchValue({
      url: 'https://api.github.com/users/octocat',
      method: 'GET',
      body: ''
    });
    while (this.headers.length > 1) {
      this.headers.removeAt(1);
    }
    this.headers.at(0)?.patchValue({ key: 'Accept', value: 'application/json' });
    this.result.set(null);
    this.errors.set([]);
    this.warnings.set([]);
  }

  applyHistory(entry: HistoryEntry): void {
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

  private addToHistory(url: string, method: string, result: RequestResult): void {
    const entry: HistoryEntry = {
      timestamp: result.timestamp,
      url,
      method,
      status: result.status,
      success: result.success
    };

    this.history.update((entries) => {
      const exists = entries.some((e) => e.url === entry.url && e.method === entry.method && e.timestamp === entry.timestamp);
      if (exists) {
        return entries;
      }
      return [entry, ...entries].slice(0, 20);
    });
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem('postman-lite-saved-requests', JSON.stringify(this.savedRequests()));
    } catch {
      // Ignore localStorage errors
    }
  }

  private loadSavedRequests(): void {
    try {
      const stored = localStorage.getItem('postman-lite-saved-requests');
      if (stored) {
        const requests = JSON.parse(stored) as SavedRequest[];
        this.savedRequests.set(requests);
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  tryParseJson(text: string | null): unknown {
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  formatJson(obj: unknown): string {
    if (obj === null || obj === undefined) {
      return '';
    }
    if (typeof obj === 'string') {
      return obj;
    }
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (days < 7) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  }

  getHeadersList(headers: Record<string, string>): Array<{ key: string; value: string }> {
    return Object.entries(headers).map(([key, value]) => ({ key, value }));
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

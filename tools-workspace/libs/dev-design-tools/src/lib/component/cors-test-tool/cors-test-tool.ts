import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface CorsTestResult {
  success: boolean;
  status: number | null;
  statusText: string;
  headers: Record<string, string>;
  corsHeaders: Record<string, string>;
  body: string | null;
  error: string | null;
  timestamp: number;
  duration: number;
}

interface HistoryEntry {
  timestamp: number;
  url: string;
  method: string;
  success: boolean;
  status: number | null;
  corsHeaders: Record<string, string>;
}

type CorsTestFormGroup = FormGroup<{
  url: FormControl<string>;
  method: FormControl<string>;
  headers: FormArray<FormGroup<{ key: FormControl<string>; value: FormControl<string> }>>;
  body: FormControl<string>;
  rememberHistory: FormControl<boolean>;
}>;

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

@Component({
  selector: 'lib-cors-test-tool',
  standalone: true,
  templateUrl: './cors-test-tool.html',
  styleUrls: ['./cors-test-tool.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CorsTestToolComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly form: CorsTestFormGroup = this.fb.group({
    url: this.fb.control('https://api.github.com', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^https?:\/\/.+/)]
    }),
    method: this.fb.control('GET', { nonNullable: true }),
    headers: this.fb.array<FormGroup<{ key: FormControl<string>; value: FormControl<string> }>>([
      this.createHeader('Content-Type', 'application/json')
    ]),
    body: this.fb.control('', { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly methods = HTTP_METHODS;
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly result = signal<CorsTestResult | null>(null);
  readonly history = signal<HistoryEntry[]>([]);
  readonly isTesting = signal(false);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly headersFormArray = computed(() => this.form.controls.headers);
  readonly Object = Object;

  constructor() {
    // Component initialization
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

  async testCors(): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);
    this.isTesting.set(true);

    const { url, method, headers, body } = this.form.getRawValue();

    if (!url || !this.form.controls.url.valid) {
      this.errors.set(['Please enter a valid URL starting with http:// or https://']);
      this.isTesting.set(false);
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

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        fetchOptions.body = body;
      }

      const response = await fetch(url, fetchOptions);
      const duration = Date.now() - startTime;

      // Extract all headers
      const allHeaders: Record<string, string> = {};
      const corsHeaders: Record<string, string> = {};

      response.headers.forEach((value, key) => {
        allHeaders[key] = value;
        if (key.toLowerCase().startsWith('access-control-')) {
          corsHeaders[key] = value;
        }
      });

      let responseBody: string | null = null;
      try {
        responseBody = await response.text();
      } catch {
        responseBody = null;
      }

      const result: CorsTestResult = {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: allHeaders,
        corsHeaders,
        body: responseBody,
        error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
        timestamp: Date.now(),
        duration
      };

      this.result.set(result);

      // Check for CORS issues
      if (Object.keys(corsHeaders).length === 0) {
        this.warnings.set(['No CORS headers found in response. This may indicate a CORS issue.']);
      }

      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(url, method, result);
      }
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      const result: CorsTestResult = {
        success: false,
        status: null,
        statusText: '',
        headers: {},
        corsHeaders: {},
        body: null,
        error: errorMessage,
        timestamp: Date.now(),
        duration
      };

      this.result.set(result);
      this.errors.set([`Request failed: ${errorMessage}`]);

      // Check if it's a CORS error
      if (errorMessage.includes('CORS') || errorMessage.includes('Access-Control')) {
        this.warnings.set(['This appears to be a CORS error. The server may not allow requests from this origin.']);
      }

      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(url, method, result);
      }
    } finally {
      this.isTesting.set(false);
    }
  }

  clear(): void {
    this.form.patchValue({
      url: 'https://api.github.com',
      method: 'GET',
      body: ''
    });
    while (this.headers.length > 1) {
      this.headers.removeAt(1);
    }
    this.headers.at(0)?.patchValue({ key: 'Content-Type', value: 'application/json' });
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

  private addToHistory(url: string, method: string, result: CorsTestResult): void {
    const entry: HistoryEntry = {
      timestamp: result.timestamp,
      url,
      method,
      success: result.success,
      status: result.status,
      corsHeaders: result.corsHeaders
    };

    this.history.update((entries) => {
      const exists = entries.some((e) => e.url === entry.url && e.method === entry.method && e.timestamp === entry.timestamp);
      if (exists) {
        return entries;
      }
      return [entry, ...entries].slice(0, 10);
    });
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
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }

  getCorsHeadersList(headers: Record<string, string>): Array<{ key: string; value: string }> {
    return Object.entries(headers)
      .filter(([key]) => key.toLowerCase().startsWith('access-control-'))
      .map(([key, value]) => ({ key, value }));
  }

  getHeadersList(headers: Record<string, string>): Array<{ key: string; value: string }> {
    return Object.entries(headers).map(([key, value]) => ({ key, value }));
  }
}

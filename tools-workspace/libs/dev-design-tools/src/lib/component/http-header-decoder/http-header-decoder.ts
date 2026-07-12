import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface DecodedHeader {
  key: string;
  value: string;
  description?: string;
  category: 'general' | 'request' | 'response' | 'entity' | 'cors' | 'custom';
}

interface HistoryEntry {
  timestamp: number;
  headers: DecodedHeader[];
  rawInput: string;
}

type HeaderDecoderFormGroup = FormGroup<{
  inputMode: FormControl<'raw' | 'keyvalue'>;
  rawHeaders: FormControl<string>;
  rememberHistory: FormControl<boolean>;
}>;

const HEADER_DESCRIPTIONS: Record<string, string> = {
  'content-type': 'Specifies the media type of the resource',
  'content-length': 'Indicates the size of the entity-body',
  'content-encoding': 'Specifies what content codings have been applied',
  'content-language': 'Describes the natural language(s) of the intended audience',
  'content-location': 'Indicates an alternate location for the returned entity',
  'content-disposition': 'Indicates how the content should be displayed',
  'accept': 'Specifies which content types the client can understand',
  'accept-encoding': 'Specifies which content encodings the client can understand',
  'accept-language': 'Specifies which languages the client can understand',
  'authorization': 'Contains credentials for authenticating the client',
  'cache-control': 'Specifies directives for caching mechanisms',
  'connection': 'Controls whether the network connection stays open',
  'cookie': 'Contains stored HTTP cookies',
  'date': 'The date and time at which the message was originated',
  'etag': 'Entity tag for the requested variant',
  'expires': 'Gives the date/time after which the response is considered stale',
  'host': 'Specifies the domain name of the server',
  'if-modified-since': 'Makes the request conditional',
  'if-none-match': 'Makes the request conditional',
  'last-modified': 'The date and time at which the origin server believes the variant was last modified',
  'location': 'Used in redirection, or when a new resource has been created',
  'referer': 'The address of the previous web page',
  'server': 'Contains information about the software used by the origin server',
  'set-cookie': 'Sends cookies from the server to the user agent',
  'user-agent': 'Contains a characteristic string that allows the network protocol peers to identify the application',
  'x-forwarded-for': 'Identifies the originating IP address of a client',
  'x-forwarded-proto': 'Identifies the protocol (HTTP or HTTPS)',
  'x-real-ip': 'Identifies the real IP address of the client',
  'access-control-allow-origin': 'Specifies which origins can access the resource',
  'access-control-allow-methods': 'Specifies the methods allowed when accessing the resource',
  'access-control-allow-headers': 'Specifies which headers can be used during the request',
  'access-control-expose-headers': 'Specifies which headers can be exposed to the client',
  'access-control-max-age': 'Indicates how long the results of a preflight request can be cached',
  'access-control-allow-credentials': 'Indicates whether the response can be shared with credentials'
};

@Component({
  selector: 'lib-http-header-decoder',
  standalone: true,
  templateUrl: './http-header-decoder.html',
  styleUrls: ['./http-header-decoder.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HttpHeaderDecoderComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly form: HeaderDecoderFormGroup = this.fb.group({
    inputMode: this.fb.control<'raw' | 'keyvalue'>('raw', { nonNullable: true }),
    rawHeaders: this.fb.control('', { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly decodedHeaders = signal<DecodedHeader[]>([]);
  readonly history = signal<HistoryEntry[]>([]);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasDecodedHeaders = computed(() => this.decodedHeaders().length > 0);
  readonly headerCount = computed(() => this.decodedHeaders().length);
  readonly corsHeadersCount = computed(() =>
    this.decodedHeaders().filter((h) => h.category === 'cors').length
  );

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.decodeHeaders();
      });
  }

  decodeHeaders(): void {
    this.errors.set([]);
    this.warnings.set([]);

    const { inputMode, rawHeaders } = this.form.getRawValue();

    if (!rawHeaders.trim()) {
      this.decodedHeaders.set([]);
      return;
    }

    try {
      let headers: DecodedHeader[] = [];

      if (inputMode === 'raw') {
        headers = this.parseRawHeaders(rawHeaders);
      } else {
        headers = this.parseKeyValueHeaders(rawHeaders);
      }

      this.decodedHeaders.set(headers);

      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(headers, rawHeaders);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to decode headers';
      this.errors.set([errorMessage]);
      this.decodedHeaders.set([]);
    }
  }

  private parseRawHeaders(raw: string): DecodedHeader[] {
    const lines = raw.split('\n').map((line) => line.trim()).filter((line) => line);
    const headers: DecodedHeader[] = [];
    let skipped = 0;

    for (const line of lines) {
      if (/^HTTP\/\d/i.test(line)) {
        headers.push(this.createDecodedHeader('Status-Line', line));
        continue;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        skipped += 1;
        continue;
      }

      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      if (key) {
        headers.push(this.createDecodedHeader(key, value));
      }
    }

    if (skipped > 0) {
      this.warnings.set([`${skipped} line(s) ignored (missing ':').`]);
    }

    return headers;
  }

  private parseKeyValueHeaders(input: string): DecodedHeader[] {
    try {
      const json = JSON.parse(input);
      const headers: DecodedHeader[] = [];

      for (const [key, value] of Object.entries(json)) {
        headers.push(this.createDecodedHeader(key, value == null ? '' : String(value)));
      }

      return headers;
    } catch {
      this.warnings.set(['Input was not valid JSON — parsed as raw headers instead.']);
      return this.parseRawHeaders(input);
    }
  }

  private createDecodedHeader(key: string, value: string): DecodedHeader {
    const lowerKey = key.toLowerCase();
    let category: DecodedHeader['category'] = 'custom';
    let description: string | undefined;

    // Determine category
    if (lowerKey.startsWith('access-control-')) {
      category = 'cors';
    } else if (['content-type', 'content-length', 'content-encoding', 'content-language', 'content-location', 'content-disposition'].includes(lowerKey)) {
      category = 'entity';
    } else if (['accept', 'accept-encoding', 'accept-language', 'authorization', 'cookie', 'host', 'referer', 'user-agent'].includes(lowerKey)) {
      category = 'request';
    } else if (['cache-control', 'connection', 'date', 'etag', 'expires', 'last-modified', 'location', 'server', 'set-cookie'].includes(lowerKey)) {
      category = 'response';
    } else if (['connection', 'date', 'pragma', 'trailer', 'transfer-encoding', 'upgrade', 'via', 'warning'].includes(lowerKey)) {
      category = 'general';
    }

    // Get description
    description = HEADER_DESCRIPTIONS[lowerKey];

    return {
      key,
      value,
      description,
      category
    };
  }

  clear(): void {
    this.form.patchValue({
      rawHeaders: ''
    });
    this.decodedHeaders.set([]);
    this.errors.set([]);
    this.warnings.set([]);
  }

  applyHistory(entry: HistoryEntry): void {
    this.form.patchValue({
      rawHeaders: entry.rawInput
    });
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  private addToHistory(headers: DecodedHeader[], rawInput: string): void {
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      headers,
      rawInput
    };

    this.history.update((entries) => {
      const exists = entries.some((e) => e.rawInput === entry.rawInput);
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

  getCategoryLabel(category: DecodedHeader['category']): string {
    const labels: Record<DecodedHeader['category'], string> = {
      general: 'General',
      request: 'Request',
      response: 'Response',
      entity: 'Entity',
      cors: 'CORS',
      custom: 'Custom'
    };
    return labels[category];
  }

  getCategoryColor(category: DecodedHeader['category']): string {
    const colors: Record<DecodedHeader['category'], string> = {
      general: '#6b7280',
      request: '#007bff',
      response: '#28a745',
      entity: '#ffc107',
      cors: '#dc3545',
      custom: '#9ca3af'
    };
    return colors[category];
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

  exportAsJson(): string {
    const headers = this.decodedHeaders();
    const json: Record<string, string> = {};
    for (const header of headers) {
      json[header.key] = header.value;
    }
    return JSON.stringify(json, null, 2);
  }

  exportAsRaw(): string {
    const headers = this.decodedHeaders();
    return headers.map((h) => `${h.key}: ${h.value}`).join('\n');
  }

  getCategories(): DecodedHeader['category'][] {
    const categories = new Set<DecodedHeader['category']>();
    for (const header of this.decodedHeaders()) {
      categories.add(header.category);
    }
    return Array.from(categories);
  }

  getHeadersByCategory(category: DecodedHeader['category']): DecodedHeader[] {
    return this.decodedHeaders().filter((h) => h.category === category);
  }
}

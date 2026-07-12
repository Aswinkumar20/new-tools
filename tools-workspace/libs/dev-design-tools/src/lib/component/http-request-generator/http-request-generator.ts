import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface HistoryEntry {
  timestamp: number;
  url: string;
  method: string;
  codeFormat: string;
}

type RequestGeneratorFormGroup = FormGroup<{
  url: FormControl<string>;
  method: FormControl<string>;
  headers: FormArray<FormGroup<{ key: FormControl<string>; value: FormControl<string> }>>;
  body: FormControl<string>;
  codeFormat: FormControl<string>;
  rememberHistory: FormControl<boolean>;
}>;

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const CODE_FORMATS = [
  { value: 'fetch', label: 'JavaScript (Fetch API)' },
  { value: 'axios', label: 'JavaScript (Axios)' },
  { value: 'curl', label: 'cURL' },
  { value: 'python', label: 'Python (requests)' },
  { value: 'node', label: 'Node.js (http)' },
  { value: 'php', label: 'PHP (cURL)' }
];

@Component({
  selector: 'lib-http-request-generator',
  standalone: true,
  templateUrl: './http-request-generator.html',
  styleUrls: ['./http-request-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HttpRequestGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly form: RequestGeneratorFormGroup = this.fb.group({
    url: this.fb.control('https://api.example.com/endpoint', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^https?:\/\/.+/)]
    }),
    method: this.fb.control('GET', { nonNullable: true }),
    headers: this.fb.array<FormGroup<{ key: FormControl<string>; value: FormControl<string> }>>([
      this.createHeader('Content-Type', 'application/json')
    ]),
    body: this.fb.control('', { nonNullable: true }),
    codeFormat: this.fb.control('fetch', { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly methods = HTTP_METHODS;
  readonly codeFormats = CODE_FORMATS;
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly history = signal<HistoryEntry[]>([]);
  readonly generatedCode = signal('');
  private readonly formTick = signal(0);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly headersFormArray = computed(() => this.form.controls.headers);
  readonly currentFormatLabel = computed(() => {
    this.formTick();
    const format = this.codeFormats.find((f) => f.value === this.form.controls.codeFormat.value);
    return format?.label || 'Fetch';
  });

  constructor() {
    this.refreshGeneratedCode();
    this.form.valueChanges
      .pipe(debounceTime(150), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.refreshGeneratedCode();
        this.updateHistory();
      });
  }

  private refreshGeneratedCode(): void {
    this.formTick.update((n) => n + 1);
    this.errors.set([]);
    this.warnings.set([]);

    const url = this.form.controls.url.value?.trim() ?? '';
    if (!url) {
      this.errors.set(['URL is required.']);
      this.generatedCode.set('');
      return;
    }
    if (!/^https?:\/\/.+/i.test(url)) {
      this.errors.set(['URL must start with http:// or https://.']);
      this.generatedCode.set(this.generateCode());
      return;
    }

    try {
      this.generatedCode.set(this.generateCode());
    } catch (error) {
      this.errors.set([error instanceof Error ? error.message : 'Failed to generate code.']);
      this.generatedCode.set('');
    }
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

  generateCode(): string {
    const { url, method, headers, body, codeFormat } = this.form.getRawValue();

    // Build headers object
    const headersObj: Record<string, string> = {};
    for (const header of headers) {
      if (header.key && header.value) {
        headersObj[header.key] = header.value;
      }
    }

    switch (codeFormat) {
      case 'fetch':
        return this.generateFetchCode(url, method, headersObj, body);
      case 'axios':
        return this.generateAxiosCode(url, method, headersObj, body);
      case 'curl':
        return this.generateCurlCode(url, method, headersObj, body);
      case 'python':
        return this.generatePythonCode(url, method, headersObj, body);
      case 'node':
        return this.generateNodeCode(url, method, headersObj, body);
      case 'php':
        return this.generatePhpCode(url, method, headersObj, body);
      default:
        return this.generateFetchCode(url, method, headersObj, body);
    }
  }

  private generateFetchCode(url: string, method: string, headers: Record<string, string>, body: string): string {
    let code = `fetch('${url}', {\n`;
    code += `  method: '${method}',\n`;

    if (Object.keys(headers).length > 0) {
      code += `  headers: {\n`;
      for (const [key, value] of Object.entries(headers)) {
        code += `    '${key}': '${value}',\n`;
      }
      code += `  },\n`;
    }

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      code += `  body: ${this.formatBodyForCode(body)},\n`;
    }

    code += `});`;
    return code;
  }

  private generateAxiosCode(url: string, method: string, headers: Record<string, string>, body: string): string {
    const methodLower = method.toLowerCase();
    let code = '';

    if (method === 'GET' || method === 'DELETE' || method === 'HEAD') {
      code += `axios.${methodLower}('${url}'`;
      if (Object.keys(headers).length > 0) {
        code += `, {\n  headers: {\n`;
        for (const [key, value] of Object.entries(headers)) {
          code += `    '${key}': '${value}',\n`;
        }
        code += `  }\n})`;
      } else {
        code += ')';
      }
    } else {
      code += `axios.${methodLower}('${url}'`;
      if (body) {
        code += `, ${this.formatBodyForCode(body)}`;
      } else {
        code += ', {}';
      }
      if (Object.keys(headers).length > 0) {
        code += `, {\n  headers: {\n`;
        for (const [key, value] of Object.entries(headers)) {
          code += `    '${key}': '${value}',\n`;
        }
        code += `  }\n})`;
      } else {
        code += ')';
      }
    }

    return code;
  }

  private generateCurlCode(url: string, method: string, headers: Record<string, string>, body: string): string {
    let code = `curl -X ${method}`;

    for (const [key, value] of Object.entries(headers)) {
      code += ` \\\n  -H '${key}: ${value}'`;
    }

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      const bodyStr = body.replace(/'/g, "'\\''");
      code += ` \\\n  -d '${bodyStr}'`;
    }

    code += ` \\\n  '${url}'`;

    return code;
  }

  private generatePythonCode(url: string, method: string, headers: Record<string, string>, body: string): string {
    let code = 'import requests\n\n';
    code += `response = requests.${method.toLowerCase()}('${url}'`;

    if (Object.keys(headers).length > 0) {
      code += `,\n    headers={\n`;
      for (const [key, value] of Object.entries(headers)) {
        code += `        '${key}': '${value}',\n`;
      }
      code += `    }`;
    }

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      if (Object.keys(headers).length > 0) {
        code += `,\n    data=${this.formatBodyForCode(body)}`;
      } else {
        code += `,\n    data=${this.formatBodyForCode(body)}`;
      }
    }

    code += `\n)`;
    return code;
  }

  private generateNodeCode(url: string, method: string, headers: Record<string, string>, body: string): string {
    let code = `const https = require('https');\n`;
    code += `const http = require('http');\n\n`;

    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      return `// Invalid URL: ${url}\n`;
    }
    const protocol = urlObj.protocol === 'https:' ? 'https' : 'http';

    code += `const options = {\n`;
    code += `  hostname: '${this.escapeSingleQuotes(urlObj.hostname)}',\n`;
    if (urlObj.port) {
      code += `  port: ${urlObj.port},\n`;
    }
    code += `  path: '${this.escapeSingleQuotes(`${urlObj.pathname}${urlObj.search}`)}',\n`;
    code += `  method: '${method}',\n`;

    if (Object.keys(headers).length > 0) {
      code += `  headers: {\n`;
      for (const [key, value] of Object.entries(headers)) {
        code += `    '${this.escapeSingleQuotes(key)}': '${this.escapeSingleQuotes(value)}',\n`;
      }
      code += `  }\n`;
    }

    code += `};\n\n`;

    code += `const req = ${protocol}.request(options, (res) => {\n`;
    code += `  console.log(\`statusCode: \${res.statusCode}\`);\n`;
    code += `  res.on('data', (d) => {\n`;
    code += `    process.stdout.write(d);\n`;
    code += `  });\n`;
    code += `});\n\n`;

    if (body && !['GET', 'HEAD'].includes(method)) {
      code += `req.write(${this.formatBodyForCode(body)});\n`;
    }

    code += `req.end();`;

    return code;
  }

  private generatePhpCode(url: string, method: string, headers: Record<string, string>, body: string): string {
    let code = `$ch = curl_init();\n\n`;

    code += `curl_setopt($ch, CURLOPT_URL, '${url}');\n`;
    code += `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n`;
    code += `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method}');\n`;

    if (Object.keys(headers).length > 0) {
      code += `curl_setopt($ch, CURLOPT_HTTPHEADER, [\n`;
      for (const [key, value] of Object.entries(headers)) {
        code += `    '${key}: ${value}',\n`;
      }
      code += `]);\n`;
    }

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      const bodyStr = body.replace(/'/g, "\\'");
      code += `curl_setopt($ch, CURLOPT_POSTFIELDS, '${bodyStr}');\n`;
    }

    code += `\n$response = curl_exec($ch);\n`;
    code += `curl_close($ch);\n`;
    code += `echo $response;`;

    return code;
  }

  private formatBodyForCode(body: string): string {
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed);
    } catch {
      return `'${this.escapeSingleQuotes(body)}'`;
    }
  }

  private escapeSingleQuotes(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
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
      url: 'https://api.example.com/endpoint',
      method: 'GET',
      body: ''
    });
    while (this.headers.length > 1) {
      this.headers.removeAt(1);
    }
    this.headers.at(0)?.patchValue({ key: 'Content-Type', value: 'application/json' });
    this.errors.set([]);
    this.warnings.set([]);
  }

  applyHistory(entry: HistoryEntry): void {
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

  private updateHistory(): void {
    if (!this.form.controls.rememberHistory.value) {
      return;
    }

    const { url, method, codeFormat } = this.form.getRawValue();

    const entry: HistoryEntry = {
      timestamp: Date.now(),
      url,
      method,
      codeFormat
    };

    this.history.update((entries) => {
      const exists = entries.some((e) => e.url === entry.url && e.method === entry.method && e.codeFormat === entry.codeFormat);
      if (exists) {
        return entries;
      }
      return [entry, ...entries].slice(0, 10);
    });
  }

  getFormatLabel(value: string): string {
    const format = this.codeFormats.find((f) => f.value === value);
    return format?.label || 'Fetch';
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
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

type CheckMode = 'auto' | 'email' | 'url' | 'ip';

type ValueType = 'email' | 'url' | 'ip' | 'unknown';

interface AnalysisResult {
  value: string;
  trimmed: string;
  type: ValueType;
  modeUsed: CheckMode;
  valid: boolean;
  issues: string[];
  info: Record<string, string | number | boolean | null>;
}

type EmailUrlIpFormGroup = FormGroup<{
  input: FormControl<string>;
  mode: FormControl<CheckMode>;
  allowMultiple: FormControl<boolean>;
  ignoreEmpty: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-email-url-ip-checker',
  standalone: true,
  templateUrl: './email-url-ip-checker.html',
  styleUrls: ['./email-url-ip-checker.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmailUrlIpCheckerComponent {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly form: EmailUrlIpFormGroup = this.fb.group({
    input: this.fb.control('', { nonNullable: true }),
    mode: this.fb.control<CheckMode>('auto', { nonNullable: true }),
    allowMultiple: this.fb.control(true, { nonNullable: true }),
    ignoreEmpty: this.fb.control(true, { nonNullable: true })
  });

  readonly results = signal<AnalysisResult[]>([]);
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);

  readonly hasResults = computed(() => this.results().length > 0);
  readonly totalCount = computed(() => this.results().length);
  readonly validCount = computed(() => this.results().filter((r) => r.valid).length);
  readonly invalidCount = computed(() => this.totalCount() - this.validCount());

  readonly typeCounts = computed(() => {
    const counts: Record<ValueType, number> = { email: 0, url: 0, ip: 0, unknown: 0 };
    for (const r of this.results()) {
      counts[r.type] = (counts[r.type] ?? 0) + 1;
    }
    return counts;
  });

  readonly Object = Object;

  readonly hasInput = computed(() => !!this.form.controls.input.value.trim());

  readonly modeLabel = computed(() => {
    const mode = this.form.controls.mode.value;
    switch (mode) {
      case 'email':
        return 'Email';
      case 'url':
        return 'URL';
      case 'ip':
        return 'IP';
      default:
        return 'Auto';
    }
  });

  onInputChange(): void {
    if (this.hasInput()) {
      this.analyze();
    } else {
      this.results.set([]);
      this.errors.set([]);
    }
  }

  onOptionChange(): void {
    if (this.hasInput()) {
      this.analyze();
    }
  }

  clear(): void {
    this.form.controls.input.setValue('');
    this.results.set([]);
    this.errors.set([]);
    this.warnings.set([]);
  }

  copyInput(): void {
    this.copyText(this.form.controls.input.value, 'Input');
  }

  copyOutput(): void {
    const lines = this.results().map((r, i) => {
      const status = r.valid ? 'Valid' : 'Invalid';
      const issues = r.issues.length ? ` — ${r.issues.join('; ')}` : '';
      return `#${i + 1} [${r.type}] ${status}: ${r.value}${issues}`;
    });
    this.copyText(lines.join('\n'), 'Results');
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }

  analyze(): void {
    this.errors.set([]);
    this.warnings.set([]);

    const { input, mode, allowMultiple, ignoreEmpty } = this.form.getRawValue();
    const raw = input ?? '';

    if (!raw.trim()) {
      this.results.set([]);
      this.errors.set(['Enter at least one value to analyze.']);
      return;
    }

    const values = allowMultiple ? raw.split(/\r?\n/) : [raw];
    const processed: AnalysisResult[] = [];

    for (const line of values) {
      const trimmed = line.trim();
      if (!trimmed && ignoreEmpty) {
        continue;
      }
      if (!trimmed) {
        processed.push({
          value: line,
          trimmed,
          type: 'unknown',
          modeUsed: mode,
          valid: false,
          issues: ['Empty line'],
          info: {}
        });
        continue;
      }

      const result = this.analyzeValue(trimmed, mode);
      processed.push(result);
    }

    if (!processed.length) {
      this.errors.set(['No non-empty values to analyze.']);
      this.results.set([]);
      return;
    }

    this.results.set(processed);
  }

  private analyzeValue(value: string, mode: CheckMode): AnalysisResult {
    const usedMode: CheckMode = mode === 'auto' ? this.detectMode(value) : mode;
    const issues: string[] = [];
    let type: ValueType = 'unknown';
    let valid = false;
    let info: Record<string, string | number | boolean | null> = {};

    switch (usedMode) {
      case 'email': {
        const res = this.validateEmail(value);
        type = 'email';
        valid = res.valid;
        issues.push(...res.issues);
        info = res.info;
        break;
      }
      case 'url': {
        const res = this.validateUrl(value);
        type = 'url';
        valid = res.valid;
        issues.push(...res.issues);
        info = res.info;
        break;
      }
      case 'ip': {
        const res = this.validateIp(value);
        type = 'ip';
        valid = res.valid;
        issues.push(...res.issues);
        info = res.info;
        break;
      }
      default: {
        type = 'unknown';
        valid = false;
        issues.push('Could not determine value type.');
      }
    }

    return {
      value,
      trimmed: value.trim(),
      type,
      modeUsed: usedMode,
      valid,
      issues,
      info
    };
  }

  private detectMode(value: string): CheckMode {
    const trimmed = value.trim();
    if (trimmed.includes('@') && /\S+@\S+\.\S+/.test(trimmed)) {
      return 'email';
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return 'url';
    }
    if (this.looksLikeIp(trimmed)) {
      return 'ip';
    }
    return 'auto';
  }

  private validateEmail(value: string): { valid: boolean; issues: string[]; info: Record<string, string | boolean | null> } {
    const issues: string[] = [];
    // Simple but practical RFC5322-ish regex
    const emailRegex =
      // eslint-disable-next-line sonarjs/regular-expression-complexity
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/;
    const valid = emailRegex.test(value);
    if (!valid) {
      issues.push('Email does not match common email format.');
    }

    const [local = '', domain = ''] = value.split('@');
    const tld = domain.includes('.') ? domain.split('.').pop() ?? '' : '';
    if (!domain) {
      issues.push('Missing domain part after "@".');
    }
    if (!local) {
      issues.push('Missing local part before "@".');
    }

    const disposableDomains = ['mailinator.com', '10minutemail.com', 'trashmail.com'];
    const looksDisposable = disposableDomains.includes(domain.toLowerCase());

    return {
      valid,
      issues,
      info: {
        localPart: local || null,
        domain: domain || null,
        tld: tld || null,
        isDisposableDomain: looksDisposable
      }
    };
  }

  private validateUrl(value: string): { valid: boolean; issues: string[]; info: Record<string, string | boolean | null> } {
    const issues: string[] = [];
    let url: URL | null = null;
    try {
      url = new URL(value);
    } catch {
      issues.push('Value is not a valid URL according to URL parser.');
    }

    const protocol = url?.protocol.replace(':', '') ?? '';
    const isSecure = protocol === 'https';
    if (!protocol) {
      issues.push('Missing or invalid protocol (e.g. http, https).');
    }

    const host = url?.hostname ?? '';
    if (!host) {
      issues.push('Missing hostname.');
    }

    const info: Record<string, string | boolean | null> = {
      protocol: protocol || null,
      host: host || null,
      port: url?.port || null,
      path: url?.pathname || null,
      query: url?.search || null,
      secure: isSecure
    };

    const valid = !!url && !!host && !!protocol;
    return { valid, issues, info };
  }

  private validateIp(value: string): { valid: boolean; issues: string[]; info: Record<string, string | boolean | null> } {
    const issues: string[] = [];
    const trimmed = value.trim();
    const isV4 = this.isValidIPv4(trimmed);
    const isV6 = !isV4 && this.isValidIPv6(trimmed);

    if (!isV4 && !isV6) {
      issues.push('Not a valid IPv4 or IPv6 address.');
    }

    const info: Record<string, string | boolean | null> = {
      version: isV4 ? 'IPv4' : isV6 ? 'IPv6' : null,
      isPrivate: isV4 ? this.isPrivateIPv4(trimmed) : null,
      isLoopback: isV4 ? trimmed === '127.0.0.1' : trimmed === '::1',
      isMulticast: isV4 ? this.isMulticastIPv4(trimmed) : null
    };

    return { valid: isV4 || isV6, issues, info };
  }

  private looksLikeIp(value: string): boolean {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) || /^[0-9a-fA-F:]+$/.test(value);
  }

  private isValidIPv4(value: string): boolean {
    const parts = value.split('.');
    if (parts.length !== 4) {
      return false;
    }
    for (const part of parts) {
      if (!/^\d{1,3}$/.test(part)) {
        return false;
      }
      const n = Number(part);
      if (n < 0 || n > 255) {
        return false;
      }
    }
    return true;
  }

  private isPrivateIPv4(value: string): boolean {
    const [a, b] = value.split('.').map((p) => Number(p));
    if (a === 10) {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
    if (a === 192 && b === 168) {
      return true;
    }
    return false;
  }

  private isMulticastIPv4(value: string): boolean {
    const first = Number(value.split('.')[0]);
    return first >= 224 && first <= 239;
  }

  private isValidIPv6(value: string): boolean {
    // Very basic IPv6 validation
    const ipv6Regex =
      /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(([0-9a-fA-F]{1,4}:){1,7}:)|(([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4})|(([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2})|(([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3})|(([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4})|(([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5})|([0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6}))|(:((:[0-9a-fA-F]{1,4}){1,7}|:)))(%.+)?$/;
    return ipv6Regex.test(value);
  }

  formatInfoValue(value: string | number | boolean | null): string {
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  }
}

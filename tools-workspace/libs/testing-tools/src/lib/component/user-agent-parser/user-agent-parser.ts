import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface ParsedUserAgent {
  raw: string;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
  engine: string | null;
  isBot: boolean;
}

type UserAgentFormGroup = FormGroup<{
  userAgent: FormControl<string>;
  useCurrent: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-user-agent-parser',
  standalone: true,
  templateUrl: './user-agent-parser.html',
  styleUrls: ['./user-agent-parser.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserAgentParserComponent {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly form: UserAgentFormGroup = this.fb.group({
    userAgent: this.fb.control('', { nonNullable: true }),
    useCurrent: this.fb.control(true, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly parsed = signal<ParsedUserAgent | null>(null);

  readonly hasParsed = computed(() => this.parsed() !== null);

  readonly hasInput = computed(() => !!this.form.controls.userAgent.value.trim());

  constructor() {
    this.populateCurrentUA();
  }

  onInputChange(): void {
    if (this.hasInput()) {
      this.parse();
    } else {
      this.parsed.set(null);
      this.errors.set([]);
    }
  }

  onUseCurrentChange(): void {
    if (this.form.controls.useCurrent.value) {
      this.populateCurrentUA();
    }
  }

  clear(): void {
    this.form.controls.userAgent.setValue('');
    this.form.controls.useCurrent.setValue(false);
    this.parsed.set(null);
    this.errors.set([]);
    this.warnings.set([]);
  }

  copyInput(): void {
    this.copyText(this.form.controls.userAgent.value, 'User agent');
  }

  copyOutput(): void {
    const p = this.parsed();
    if (!p) return;
    const lines = [
      `Browser: ${p.browser ?? 'Unknown'}${p.browserVersion ? ` (${p.browserVersion})` : ''}`,
      `OS: ${p.os ?? 'Unknown'}${p.osVersion ? ` (${p.osVersion})` : ''}`,
      `Engine: ${p.engine ?? 'Unknown'}`,
      `Device: ${p.deviceType}`,
      `Bot: ${p.isBot ? 'Yes' : 'No'}`,
      '',
      'Raw:',
      p.raw,
    ];
    this.copyText(lines.join('\n'), 'Parsed details');
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }

  populateCurrentUA(): void {
    if (typeof navigator !== 'undefined' && this.form.controls.useCurrent.value) {
      this.form.controls.userAgent.setValue(navigator.userAgent);
      this.parse();
    }
  }

  parse(): void {
    this.errors.set([]);
    this.warnings.set([]);
    const ua = this.form.controls.userAgent.value.trim();

    if (!ua) {
      this.errors.set(['Enter a user agent string to parse.']);
      this.parsed.set(null);
      return;
    }

    const parsed = this.parseUserAgent(ua);
    this.parsed.set(parsed);
  }

  private parseUserAgent(ua: string): ParsedUserAgent {
    const lower = ua.toLowerCase();

    const isBot =
      /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|curl|wget|postman/i.test(ua) ||
      /headlesschrome/i.test(ua);

    let browser: string | null = null;
    let browserVersion: string | null = null;

    if (/edg\//i.test(ua)) {
      browser = 'Microsoft Edge';
      browserVersion = this.extractVersion(ua, /edg\/([\d.]+)/i);
    } else if (/chrome\/|crios\//i.test(ua) && !/chromium/i.test(ua)) {
      browser = 'Chrome';
      browserVersion = this.extractVersion(ua, /(?:chrome|crios)\/([\d.]+)/i);
    } else if (/safari\//i.test(ua) && !/chrome|crios|edg\//i.test(ua)) {
      browser = 'Safari';
      browserVersion = this.extractVersion(ua, /version\/([\d.]+)/i);
    } else if (/firefox\/|fxios\//i.test(ua)) {
      browser = 'Firefox';
      browserVersion = this.extractVersion(ua, /(?:firefox|fxios)\/([\d.]+)/i);
    } else if (/msie |trident\//i.test(ua)) {
      browser = 'Internet Explorer';
      browserVersion = this.extractVersion(ua, /(?:msie |rv:)([\d.]+)/i);
    } else if (/opera|opr\//i.test(ua)) {
      browser = 'Opera';
      browserVersion = this.extractVersion(ua, /(?:opera|opr)\/([\d.]+)/i);
    }

    let os: string | null = null;
    let osVersion: string | null = null;

    if (/windows nt/i.test(ua)) {
      os = 'Windows';
      osVersion = this.extractVersion(ua, /windows nt ([\d.]+)/i);
    } else if (/android/i.test(ua)) {
      os = 'Android';
      osVersion = this.extractVersion(ua, /android ([\d.]+)/i);
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      os = 'iOS';
      const extractedIosVersion = this.extractVersion(ua, /os ([\d_]+)/i);
      osVersion = extractedIosVersion ? extractedIosVersion.replace(/_/g, '.') : null;
    } else if (/mac os x/i.test(ua)) {
      os = 'macOS';
      const extractedMacVersion = this.extractVersion(ua, /mac os x ([\d_]+)/i);
      osVersion = extractedMacVersion ? extractedMacVersion.replace(/_/g, '.') : null;
    } else if (/linux/i.test(ua)) {
      os = 'Linux';
    }

    let deviceType: ParsedUserAgent['deviceType'] = 'unknown';
    if (/mobile/i.test(ua)) {
      deviceType = 'mobile';
    } else if (/tablet|ipad/i.test(ua)) {
      deviceType = 'tablet';
    } else if (/android|iphone|ipad|ipod/i.test(ua)) {
      deviceType = 'mobile';
    } else if (/windows|macintosh|linux/i.test(ua)) {
      deviceType = 'desktop';
    }

    if (isBot) {
      deviceType = 'bot';
    }

    let engine: string | null = null;
    if (/applewebkit/i.test(ua)) {
      engine = 'WebKit';
    }
    if (/gecko\/\d/i.test(ua) && !/like gecko/i.test(ua)) {
      engine = engine ? `${engine} + Gecko` : 'Gecko';
    }
    if (/trident\/\d/i.test(ua)) {
      engine = 'Trident';
    }

    return {
      raw: ua,
      browser,
      browserVersion,
      os,
      osVersion,
      deviceType,
      engine,
      isBot
    };
  }

  private extractVersion(ua: string, regex: RegExp): string | null {
    const match = ua.match(regex);
    return match && match[1] ? match[1] : null;
  }
}

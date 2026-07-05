import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

type JwtPart = 'header' | 'payload' | 'signature';

interface DecodedSection {
  raw: string;
  json: string | null;
  error: string | null;
}

interface DecodedJwt {
  header: DecodedSection;
  payload: DecodedSection;
  signature: {
    raw: string;
    present: boolean;
  };
}

type JwtDecoderFormGroup = FormGroup<{
  token: FormControl<string>;
  prettyPrint: FormControl<boolean>;
  showDecoded: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-jwt-decoder',
  standalone: true,
  templateUrl: './jwt-decoder.html',
  styleUrls: ['./jwt-decoder.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JwtDecoderComponent {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly form: JwtDecoderFormGroup = this.fb.group({
    token: this.fb.control('', { nonNullable: true }),
    prettyPrint: this.fb.control(true, { nonNullable: true }),
    showDecoded: this.fb.control(true, { nonNullable: true }),
  });

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly decoded = signal<DecodedJwt | null>(null);

  readonly hasToken = computed(() => !!this.form.controls.token.value.trim());
  readonly hasDecoded = computed(() => this.decoded() !== null);

  get tokenParts(): number {
    const token = this.form.controls.token.value.trim();
    return token ? token.split('.').length : 0;
  }

  onTokenInput(): void {
    if (this.hasToken()) {
      this.decode();
    } else {
      this.clearResults();
    }
  }

  onOptionChange(): void {
    if (this.hasToken()) {
      this.decode();
    }
  }

  decode(): void {
    this.errors.set([]);
    this.warnings.set([]);
    this.decoded.set(null);

    const token = this.form.controls.token.value.trim();
    if (!token) {
      return;
    }

    const parts = token.split('.');
    if (parts.length < 2 || parts.length > 3) {
      this.errors.set(['A JWT should have 2 or 3 parts separated by dots (header.payload[.signature]).']);
    }

    const [headerPart = '', payloadPart = '', signaturePart = ''] = parts;

    const header = this.decodePart(headerPart, 'header');
    const payload = this.decodePart(payloadPart, 'payload');
    const signature = {
      raw: signaturePart,
      present: !!signaturePart,
    };

    this.decoded.set({ header, payload, signature });

    if (!signaturePart) {
      this.warnings.set(['No signature part present. This may be an unsecured JWT (alg: none).']);
    }
  }

  clear(): void {
    this.form.controls.token.setValue('');
    this.clearResults();
  }

  copyToken(): void {
    this.copyText(this.form.controls.token.value, 'Token');
  }

  copyDecoded(): void {
    const d = this.decoded();
    if (!d) return;
    const text = [
      '--- Header ---',
      d.header.json ?? d.header.raw,
      '',
      '--- Payload ---',
      d.payload.json ?? d.payload.raw,
      '',
      '--- Signature ---',
      d.signature.present ? d.signature.raw : '(none)',
    ].join('\n');
    this.copyText(text, 'Decoded JWT');
  }

  private clearResults(): void {
    this.errors.set([]);
    this.warnings.set([]);
    this.decoded.set(null);
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }

  private decodePart(part: string, type: JwtPart): DecodedSection {
    if (!part) {
      return {
        raw: '',
        json: null,
        error: `${type === 'header' ? 'Header' : 'Payload'} part is missing.`,
      };
    }

    try {
      const padded = this.padBase64(part.replace(/-/g, '+').replace(/_/g, '/'));
      const decoded = atob(padded);
      let json: unknown;
      try {
        json = JSON.parse(decoded);
      } catch (e) {
        return {
          raw: decoded,
          json: null,
          error: `Could not parse ${type} JSON: ${(e as Error).message}`,
        };
      }

      const pretty = this.form.controls.prettyPrint.value;
      const jsonText = pretty ? JSON.stringify(json, null, 2) : JSON.stringify(json);

      return {
        raw: decoded,
        json: jsonText,
        error: null,
      };
    } catch (e) {
      return {
        raw: part,
        json: null,
        error: `Failed to base64url-decode ${type}: ${(e as Error).message}`,
      };
    }
  }

  private padBase64(value: string): string {
    const remainder = value.length % 4;
    if (remainder === 2) return `${value}==`;
    if (remainder === 3) return `${value}=`;
    if (remainder === 1) throw new Error('Invalid base64url string length');
    return value;
  }
}

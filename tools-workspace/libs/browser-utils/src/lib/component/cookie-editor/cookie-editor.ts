import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface CookieEntry {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

type CookieFormGroup = FormGroup<{
  name: FormControl<string>;
  value: FormControl<string>;
  domain: FormControl<string>;
  path: FormControl<string>;
  daysToExpire: FormControl<number | null>;
  secure: FormControl<boolean>;
  sameSite: FormControl<'Strict' | 'Lax' | 'None'>;
}>;

@Component({
  selector: 'lib-cookie-editor',
  standalone: true,
  templateUrl: './cookie-editor.html',
  styleUrls: ['./cookie-editor.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CookieEditorComponent {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly form: CookieFormGroup = this.fb.group({
    name: this.fb.control('', { nonNullable: true }),
    value: this.fb.control('', { nonNullable: true }),
    domain: this.fb.control('', { nonNullable: true }),
    path: this.fb.control('/', { nonNullable: true }),
    daysToExpire: this.fb.control<number | null>(7, { nonNullable: true }),
    secure: this.fb.control(false, { nonNullable: true }),
    sameSite: this.fb.control<'Strict' | 'Lax' | 'None'>('Lax', { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly cookies = signal<CookieEntry[]>(this.readCookies());
  readonly filterQuery = signal<string>('');
  readonly editingCookie = signal<string | null>(null);

  readonly filteredCookies = computed(() => {
    const query = this.filterQuery().toLowerCase().trim();
    if (!query) return this.cookies();
    return this.cookies().filter(
      (c) => c.name.toLowerCase().includes(query) || c.value.toLowerCase().includes(query)
    );
  });

  readonly hasCookies = computed(() => this.cookies().length > 0);
  readonly cookieCount = computed(() => this.cookies().length);

  refresh(): void {
    this.errors.set([]);
    this.cookies.set(this.readCookies());
    this.editingCookie.set(null);
  }

  private readCookies(): CookieEntry[] {
    if (!document.cookie) {
      return [];
    }
    const entries: CookieEntry[] = [];
    const cookieStrings = document.cookie.split(';');

    for (const cookieStr of cookieStrings) {
      const trimmed = cookieStr.trim();
      if (!trimmed) continue;

      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) continue;

      const name = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim();

      try {
        entries.push({
          name: decodeURIComponent(name),
          value: decodeURIComponent(value)
        });
      } catch {
        entries.push({
        name,
          value
    });
      }
    }

    return entries;
  }

  loadCookie(cookie: CookieEntry): void {
    this.form.patchValue({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || '',
      path: cookie.path || '/',
      secure: cookie.secure || false,
      sameSite: cookie.sameSite || 'Lax',
      daysToExpire: null
    });
    this.editingCookie.set(cookie.name);
  }

  saveCookie(): void {
    this.errors.set([]);
    const { name, value, domain, path, daysToExpire, secure, sameSite } = this.form.getRawValue();

    if (!name.trim()) {
      this.errors.set(['Cookie name cannot be empty.']);
      return;
    }

    const parts: string[] = [];
    parts.push(`${encodeURIComponent(name.trim())}=${encodeURIComponent(value)}`);

    if (domain.trim()) {
      parts.push(`Domain=${domain.trim()}`);
    }

    if (path.trim()) {
      parts.push(`Path=${path.trim()}`);
    }

    if (daysToExpire !== null && Number.isFinite(daysToExpire) && daysToExpire > 0) {
      const date = new Date();
      date.setTime(date.getTime() + daysToExpire * 24 * 60 * 60 * 1000);
      parts.push(`Expires=${date.toUTCString()}`);
    } else if (daysToExpire === null || daysToExpire === 0) {
      // Session cookie - no expires
    }

    if (secure) {
      parts.push('Secure');
    }

    if (sameSite) {
      parts.push(`SameSite=${sameSite}`);
    }

    try {
    document.cookie = parts.join('; ');
    this.refresh();
      this.clearEditor();
    } catch (e) {
      this.errors.set([e instanceof Error ? e.message : 'Failed to set cookie.']);
    }
  }

  deleteCookie(name: string): void {
    this.errors.set([]);
    const path = this.form.controls.path.value || '/';
    const domain = this.form.controls.domain.value;

    const parts: string[] = [`${encodeURIComponent(name)}=`, 'Expires=Thu, 01 Jan 1970 00:00:00 GMT'];
    if (path) {
      parts.push(`Path=${path}`);
    }
    if (domain) {
      parts.push(`Domain=${domain}`);
    }

    document.cookie = parts.join('; ');
    this.refresh();
    if (this.editingCookie() === name) {
      this.clearEditor();
    }
  }

  clearEditor(): void {
    this.form.reset({
      name: '',
      value: '',
      domain: '',
      path: '/',
      daysToExpire: 7,
      secure: false,
      sameSite: 'Lax'
    });
    this.editingCookie.set(null);
  }

  deleteAllCookies(): void {
    this.errors.set([]);
    const cookies = this.cookies();
    for (const cookie of cookies) {
      this.deleteCookie(cookie.name);
    }
    this.refresh();
  }

  formatValue(value: string): string {
    if (value.length > 100) {
      return value.substring(0, 100) + '...';
    }
    return value;
  }

  onFilterChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.filterQuery.set(target.value);
  }

  copyCookieValue(cookie: CookieEntry): void {
    this.copyText(`${cookie.name}=${cookie.value}`, cookie.name);
  }

  copyAllCookies(): void {
    const text = this.cookies()
      .map((c) => `${c.name}=${c.value}`)
      .join('\n');
    this.copyText(text, 'All cookies');
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }
}

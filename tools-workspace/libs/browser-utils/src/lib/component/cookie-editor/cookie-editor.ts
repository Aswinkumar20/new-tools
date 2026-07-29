import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map, startWith } from 'rxjs/operators';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { buCopyText } from '../../shared/bu-clipboard.util';
import {
  COOKIE_DEFAULT_FORM_VALUES,
  COOKIE_RELATED_TOOLS,
  COOKIE_SAME_SITE_OPTIONS
} from '../../constants/cookie-editor.constants';
import type { BuRelatedToolLink, BuToolSuggestion } from '../../shared/bu-tool-suggestion.model';
import type { CookieEntry, CookieFormValues, CookieSameSite } from '../../types/cookie-editor.types';
import {
  buildCookieDeleteString,
  buildCookieSetString,
  filterCookieEntries,
  formatCookieValuePreview,
  parseDocumentCookies,
  resolveCookieSuggestion,
  serializeAllCookies,
  serializeCookieLine
} from '../../utils/cookie-editor.utils';

type CookieFormGroup = FormGroup<{
  name: FormControl<string>;
  value: FormControl<string>;
  domain: FormControl<string>;
  path: FormControl<string>;
  daysToExpire: FormControl<number | null>;
  secure: FormControl<boolean>;
  sameSite: FormControl<CookieSameSite>;
}>;

@Component({
  selector: 'lib-cookie-editor',
  standalone: true,
  templateUrl: './cookie-editor.html',
  styleUrls: ['./cookie-editor.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CookieEditorComponent {
  private readonly formBuilder = inject(FormBuilder);
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  readonly sameSiteOptions = COOKIE_SAME_SITE_OPTIONS;
  readonly relatedTools: ReadonlyArray<BuRelatedToolLink> = COOKIE_RELATED_TOOLS;
  readonly formatValue = formatCookieValuePreview;

  readonly form: CookieFormGroup = this.formBuilder.group({
    name: this.formBuilder.control(COOKIE_DEFAULT_FORM_VALUES.name, { nonNullable: true }),
    value: this.formBuilder.control(COOKIE_DEFAULT_FORM_VALUES.value, { nonNullable: true }),
    domain: this.formBuilder.control(COOKIE_DEFAULT_FORM_VALUES.domain, { nonNullable: true }),
    path: this.formBuilder.control(COOKIE_DEFAULT_FORM_VALUES.path, { nonNullable: true }),
    daysToExpire: this.formBuilder.control<number | null>(COOKIE_DEFAULT_FORM_VALUES.daysToExpire, {
      nonNullable: true
    }),
    secure: this.formBuilder.control(COOKIE_DEFAULT_FORM_VALUES.secure, { nonNullable: true }),
    sameSite: this.formBuilder.control<CookieSameSite>(COOKIE_DEFAULT_FORM_VALUES.sameSite, {
      nonNullable: true
    })
  });

  readonly errors = signal<string[]>([]);
  readonly cookies = signal<CookieEntry[]>(this.readCookies());
  readonly filterQuery = signal('');
  readonly editingCookie = signal<string | null>(null);
  readonly dismissedSuggestionId = signal<string | null>(null);

  private readonly formSnapshot = toSignal(
    this.form.valueChanges.pipe(
      startWith(undefined),
      map(() => this.form.getRawValue())
    ),
    { initialValue: this.form.getRawValue() }
  );

  readonly filteredCookies = computed(() =>
    filterCookieEntries(this.cookies(), this.filterQuery())
  );

  readonly hasCookies = computed(() => this.cookies().length > 0);
  readonly cookieCount = computed(() => this.cookies().length);

  readonly needsSecureForSameSiteNone = computed(() => {
    const values = this.formSnapshot();
    return values.sameSite === 'None' && !values.secure;
  });

  readonly primarySuggestion = computed<BuToolSuggestion | null>(() => {
    const suggestion = resolveCookieSuggestion(this.formSnapshot(), this.cookieCount());
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  refreshCookies(): void {
    this.errors.set([]);
    this.cookies.set(this.readCookies());
    this.editingCookie.set(null);
  }

  /** Template-compatible alias preserving existing call sites. */
  refresh(): void {
    this.refreshCookies();
  }

  private readCookies(): CookieEntry[] {
    if (typeof document === 'undefined') {
      return [];
    }
    return parseDocumentCookies(document.cookie);
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
    const values = this.form.getRawValue();
    const wasEditing = !!this.editingCookie();

    if (!values.name.trim()) {
      this.errors.set(['Cookie name cannot be empty.']);
      return;
    }

    try {
      document.cookie = buildCookieSetString(values);
      this.refreshCookies();
      this.clearEditor();
      this.toast.success(wasEditing ? 'Cookie updated' : 'Cookie created');
    } catch (error) {
      this.errors.set([error instanceof Error ? error.message : 'Failed to set cookie.']);
    }
  }

  deleteCookie(name: string): void {
    this.errors.set([]);
    const path = this.form.controls.path.value || '/';
    const domain = this.form.controls.domain.value;

    document.cookie = buildCookieDeleteString(name, path, domain);
    this.refreshCookies();
    if (this.editingCookie() === name) {
      this.clearEditor();
    }
    this.toast.info(`Deleted cookie “${name}”`);
  }

  clearEditor(): void {
    this.form.reset({ ...COOKIE_DEFAULT_FORM_VALUES });
    this.editingCookie.set(null);
  }

  deleteAllCookies(): void {
    this.errors.set([]);
    const path = this.form.controls.path.value || '/';
    const domain = this.form.controls.domain.value;
    const cookies = this.cookies();

    for (const cookie of cookies) {
      document.cookie = buildCookieDeleteString(cookie.name, path, domain);
    }

    this.refreshCookies();
    this.clearEditor();
    if (cookies.length) {
      this.toast.info('All visible cookies deleted');
    }
  }

  onFilterChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.filterQuery.set(target.value);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  copyCookieValue(cookie: CookieEntry): void {
    buCopyText(this.toast, serializeCookieLine(cookie), cookie.name);
  }

  copyAllCookies(): void {
    buCopyText(this.toast, serializeAllCookies(this.cookies()), 'All cookies');
  }
}

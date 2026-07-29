import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ddCopyText } from '../../shared/dd-clipboard.util';
import type { DdRelatedToolLink } from '../../shared/dd-tool-suggestion.model';
import { HTTP_HEADER_RELATED_TOOLS } from '../../constants/http-header-decoder.constants';
import type {
  DecodedHeader,
  HeaderCategory,
  HeaderHistoryEntry,
  HeaderInputMode
} from '../../types/http-header-decoder.types';
import {
  decodeHttpHeaders,
  exportHeadersAsJson,
  exportHeadersAsRaw,
  formatRelativeTimestamp,
  getCategoryColor,
  getCategoryLabel,
  getHeaderCategories,
  getHeadersByCategory,
  prependHeaderHistory,
  resolveHttpHeaderSuggestion
} from '../../utils/http-header-decoder.utils';

type HeaderDecoderFormGroup = FormGroup<{
  inputMode: FormControl<HeaderInputMode>;
  rawHeaders: FormControl<string>;
  rememberHistory: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-http-header-decoder',
  standalone: true,
  templateUrl: './http-header-decoder.html',
  styleUrls: ['./http-header-decoder.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HttpHeaderDecoderComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly form: HeaderDecoderFormGroup = this.fb.group({
    inputMode: this.fb.control<HeaderInputMode>('raw', { nonNullable: true }),
    rawHeaders: this.fb.control('', { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly relatedTools: ReadonlyArray<DdRelatedToolLink> = HTTP_HEADER_RELATED_TOOLS;
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly decodedHeaders = signal<DecodedHeader[]>([]);
  readonly history = signal<HeaderHistoryEntry[]>([]);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasDecodedHeaders = computed(() => this.decodedHeaders().length > 0);
  readonly headerCount = computed(() => this.decodedHeaders().length);
  readonly corsHeadersCount = computed(() =>
    this.decodedHeaders().filter((h) => h.category === 'cors').length
  );
  readonly primarySuggestion = computed(() => {
    const suggestion = resolveHttpHeaderSuggestion(this.decodedHeaders());
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.dismissedSuggestionId.set(null);
        this.decodeHeaders();
      });
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
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
      const { headers, warnings } = decodeHttpHeaders(rawHeaders, inputMode);
      this.decodedHeaders.set(headers);
      this.warnings.set(warnings);

      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(headers, rawHeaders);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to decode headers';
      this.errors.set([errorMessage]);
      this.decodedHeaders.set([]);
    }
  }

  clear(): void {
    this.dismissedSuggestionId.set(null);
    this.form.patchValue({
      rawHeaders: ''
    });
    this.decodedHeaders.set([]);
    this.errors.set([]);
    this.warnings.set([]);
  }

  applyHistory(entry: HeaderHistoryEntry): void {
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

  formatTimestamp(timestamp: number): string {
    return formatRelativeTimestamp(timestamp);
  }

  getCategoryLabel(category: HeaderCategory): string {
    return getCategoryLabel(category);
  }

  getCategoryColor(category: HeaderCategory): string {
    return getCategoryColor(category);
  }

  async copyToClipboard(text: string, label: string): Promise<void> {
    const ok = await ddCopyText(this.toast, text, label);
    if (ok) {
      this.errors.set([]);
    } else {
      this.errors.set([`Unable to copy ${label} to clipboard.`]);
    }
  }

  exportAsJson(): string {
    return exportHeadersAsJson(this.decodedHeaders());
  }

  exportAsRaw(): string {
    return exportHeadersAsRaw(this.decodedHeaders());
  }

  getCategories(): HeaderCategory[] {
    return getHeaderCategories(this.decodedHeaders());
  }

  getHeadersByCategory(category: HeaderCategory): DecodedHeader[] {
    return getHeadersByCategory(this.decodedHeaders(), category);
  }

  private addToHistory(headers: DecodedHeader[], rawInput: string): void {
    const entry: HeaderHistoryEntry = {
      timestamp: Date.now(),
      headers,
      rawInput
    };

    this.history.update((entries) => prependHeaderHistory(entries, entry));
  }
}

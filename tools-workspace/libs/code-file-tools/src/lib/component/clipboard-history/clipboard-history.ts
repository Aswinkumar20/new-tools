import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { startWith } from 'rxjs/operators';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { cftCopyText } from '../../shared/cft-clipboard.util';
import { cftDownloadJson, cftDownloadTimestamp } from '../../shared/cft-download.util';
import type { CftRelatedToolLink, CftToolSuggestion } from '../../shared/cft-tool-suggestion.model';
import {
  CLIPBOARD_HISTORY_COPY_SUCCESS_MS,
  CLIPBOARD_HISTORY_DEFAULT_SETTINGS,
  CLIPBOARD_HISTORY_POLL_INTERVAL_MS,
  CLIPBOARD_HISTORY_RELATED_TOOLS,
  CLIPBOARD_HISTORY_SETTINGS_KEY,
  CLIPBOARD_HISTORY_STORAGE_KEY
} from '../../constants/clipboard-history.constants';
import type { ClipboardEntry, ClipboardHistorySettings } from '../../types/clipboard-history.types';
import {
  canAddClipboardText,
  createClipboardEntry,
  filterClipboardHistory,
  formatClipboardBytes,
  formatClipboardTimestamp,
  isClipboardApiSupported,
  parseClipboardHistory,
  parseClipboardSettings,
  prependClipboardEntry,
  promoteClipboardEntry,
  resolveClipboardHistorySuggestion
} from '../../utils/clipboard-history.utils';

type SettingsFormGroup = FormGroup<{
  autoMonitor: FormControl<boolean>;
  maxEntries: FormControl<number>;
  excludeDuplicates: FormControl<boolean>;
  minLength: FormControl<number>;
  maxLength: FormControl<number>;
}>;

@Component({
  selector: 'lib-clipboard-history',
  standalone: true,
  templateUrl: './clipboard-history.html',
  styleUrls: ['./clipboard-history.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClipboardHistoryComponent implements OnInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private copySuccessTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastClipboardText = '';

  readonly relatedTools: ReadonlyArray<CftRelatedToolLink> = CLIPBOARD_HISTORY_RELATED_TOOLS;
  readonly formatTimestamp = formatClipboardTimestamp;
  readonly formatBytes = formatClipboardBytes;

  readonly form: SettingsFormGroup = this.formBuilder.group({
    autoMonitor: this.formBuilder.control(CLIPBOARD_HISTORY_DEFAULT_SETTINGS.autoMonitor, {
      nonNullable: true
    }),
    maxEntries: this.formBuilder.control(CLIPBOARD_HISTORY_DEFAULT_SETTINGS.maxEntries, {
      nonNullable: true
    }),
    excludeDuplicates: this.formBuilder.control(
      CLIPBOARD_HISTORY_DEFAULT_SETTINGS.excludeDuplicates,
      { nonNullable: true }
    ),
    minLength: this.formBuilder.control(CLIPBOARD_HISTORY_DEFAULT_SETTINGS.minLength, {
      nonNullable: true
    }),
    maxLength: this.formBuilder.control(CLIPBOARD_HISTORY_DEFAULT_SETTINGS.maxLength, {
      nonNullable: true
    })
  });

  readonly history = signal<ClipboardEntry[]>([]);
  readonly searchQuery = signal('');
  readonly selectedEntry = signal<ClipboardEntry | null>(null);
  readonly errors = signal<string[]>([]);
  readonly copySuccess = signal<string | null>(null);
  readonly dismissedSuggestionId = signal<string | null>(null);

  private readonly autoMonitorEnabled = toSignal(
    this.form.controls.autoMonitor.valueChanges.pipe(
      startWith(this.form.controls.autoMonitor.value)
    ),
    { initialValue: this.form.controls.autoMonitor.value }
  );

  readonly filteredHistory = computed(() =>
    filterClipboardHistory(this.history(), this.searchQuery())
  );

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly totalEntries = computed(() => this.history().length);
  readonly clipboardSupported = computed(() => isClipboardApiSupported(this.isBrowser));
  readonly monitorLabel = computed(() => (this.autoMonitorEnabled() ? 'On' : 'Off'));

  readonly primarySuggestion = computed<CftToolSuggestion | null>(() => {
    const suggestion = resolveClipboardHistorySuggestion(
      this.clipboardSupported(),
      this.history().length,
      this.selectedEntry()
    );
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  ngOnInit(): void {
    this.loadHistory();
    this.loadSettings();

    if (this.form.controls.autoMonitor.value) {
      this.startMonitoring();
    }

    this.form.controls.autoMonitor.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => {
        if (enabled) {
          this.startMonitoring();
        } else {
          this.stopMonitoring();
        }
      });

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.saveSettings();
    });
  }

  ngOnDestroy(): void {
    this.stopMonitoring();
    if (this.copySuccessTimeoutId) {
      clearTimeout(this.copySuccessTimeoutId);
      this.copySuccessTimeoutId = null;
    }
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  async addToHistory(text: string): Promise<void> {
    const settings = this.form.getRawValue();
    if (!canAddClipboardText(text, this.history(), settings)) {
      return;
    }

    const entry = createClipboardEntry(text);
    this.history.update((entries) => prependClipboardEntry(entries, entry, settings.maxEntries));
    this.saveHistory();
  }

  copySelected(): void {
    const entry = this.selectedEntry();
    if (entry) {
      void this.copyToClipboard(entry);
    }
  }

  async copyToClipboard(entry: ClipboardEntry): Promise<void> {
    const copied = await cftCopyText(this.toast, entry.text, 'Clipboard entry');
    if (!copied) {
      this.errors.set(['Failed to copy to clipboard.']);
      return;
    }

    this.copySuccess.set(entry.id);
    if (this.copySuccessTimeoutId) {
      clearTimeout(this.copySuccessTimeoutId);
    }
    this.copySuccessTimeoutId = setTimeout(() => {
      this.copySuccess.set(null);
      this.copySuccessTimeoutId = null;
    }, CLIPBOARD_HISTORY_COPY_SUCCESS_MS);

    this.history.update((entries) => promoteClipboardEntry(entries, entry));
    this.saveHistory();
  }

  async manualAdd(): Promise<void> {
    if (!this.clipboardSupported()) {
      this.errors.set(['Clipboard API is not supported in this browser.']);
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        await this.addToHistory(text);
        this.toast.info('Clipboard entry added');
      }
    } catch (error) {
      const message = (error as Error)?.message ?? 'Unknown error';
      this.errors.set([`Failed to read clipboard: ${message}`]);
      this.toast.error('Failed to read clipboard');
    }
  }

  selectEntry(entry: ClipboardEntry): void {
    this.selectedEntry.set(entry);
  }

  removeEntry(id: string): void {
    this.history.update((entries) => entries.filter((entry) => entry.id !== id));
    this.saveHistory();
    if (this.selectedEntry()?.id === id) {
      this.selectedEntry.set(null);
    }
    this.toast.info('Entry removed');
  }

  clearHistory(): void {
    this.history.set([]);
    this.selectedEntry.set(null);
    this.saveHistory();
    this.toast.info('History cleared');
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
  }

  downloadJson(): void {
    try {
      cftDownloadJson(
        {
          entries: this.history(),
          settings: this.form.getRawValue()
        },
        `clipboard-history-${cftDownloadTimestamp()}.json`
      );
      this.toast.success('Clipboard history downloaded');
    } catch {
      this.toast.error('Could not download clipboard history');
    }
  }

  private startMonitoring(): void {
    this.stopMonitoring();
    if (!this.isBrowser) {
      return;
    }
    if (!navigator.clipboard) {
      this.errors.set(['Clipboard API not supported in this browser.']);
      return;
    }

    this.pollIntervalId = setInterval(() => {
      void this.checkClipboard();
    }, CLIPBOARD_HISTORY_POLL_INTERVAL_MS);
  }

  private stopMonitoring(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  private async checkClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text !== this.lastClipboardText) {
        this.lastClipboardText = text;
        await this.addToHistory(text);
      }
    } catch {
      // Clipboard read may fail without focus/permission; keep polling quietly.
    }
  }

  private loadHistory(): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      const stored = localStorage.getItem(CLIPBOARD_HISTORY_STORAGE_KEY);
      this.history.set(parseClipboardHistory(stored));
    } catch {
      this.errors.set(['Failed to load clipboard history from local storage.']);
    }
  }

  private saveHistory(): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      localStorage.setItem(CLIPBOARD_HISTORY_STORAGE_KEY, JSON.stringify(this.history()));
    } catch {
      this.errors.set(['Failed to save history. Storage may be full.']);
      this.toast.error('Failed to save history');
    }
  }

  private loadSettings(): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      const stored = localStorage.getItem(CLIPBOARD_HISTORY_SETTINGS_KEY);
      const settings = parseClipboardSettings(stored, CLIPBOARD_HISTORY_DEFAULT_SETTINGS);
      this.form.patchValue(settings);
    } catch {
      // Keep defaults when settings are corrupt.
    }
  }

  private saveSettings(): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      localStorage.setItem(
        CLIPBOARD_HISTORY_SETTINGS_KEY,
        JSON.stringify(this.form.getRawValue() as ClipboardHistorySettings)
      );
    } catch {
      // Settings persistence is best-effort.
    }
  }
}

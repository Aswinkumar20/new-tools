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
import { cftDownloadBlob } from '../../shared/cft-download.util';
import type { CftRelatedToolLink, CftToolSuggestion } from '../../shared/cft-tool-suggestion.model';
import {
  CLIPBOARD_VIEWER_DEFAULT_SETTINGS,
  CLIPBOARD_VIEWER_RELATED_TOOLS
} from '../../constants/clipboard-viewer.constants';
import type { ClipboardContent } from '../../types/clipboard-viewer.types';
import { formatClipboardBytes } from '../../utils/clipboard-history.utils';
import {
  createEmptyClipboardContent,
  formatClipboardViewerTimestamp,
  getClipboardFileExtension,
  getClipboardMimeType,
  isClipboardViewerSupported,
  mapClipboardPermissionErrors,
  processClipboardContent,
  resolveClipboardViewerSuggestion,
  shouldTreatClipboardErrorAsEmpty
} from '../../utils/clipboard-viewer.utils';

type ViewerFormGroup = FormGroup<{
  autoRefresh: FormControl<boolean>;
  refreshInterval: FormControl<number>;
  showMetadata: FormControl<boolean>;
  wordWrap: FormControl<boolean>;
  fontSize: FormControl<number>;
}>;

@Component({
  selector: 'lib-clipboard-viewer',
  standalone: true,
  templateUrl: './clipboard-viewer.html',
  styleUrls: ['./clipboard-viewer.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClipboardViewerComponent implements OnInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private refreshIntervalId: ReturnType<typeof setInterval> | null = null;

  readonly relatedTools: ReadonlyArray<CftRelatedToolLink> = CLIPBOARD_VIEWER_RELATED_TOOLS;
  readonly formatTimestamp = formatClipboardViewerTimestamp;
  readonly formatBytes = formatClipboardBytes;

  readonly form: ViewerFormGroup = this.formBuilder.group({
    autoRefresh: this.formBuilder.control(CLIPBOARD_VIEWER_DEFAULT_SETTINGS.autoRefresh, {
      nonNullable: true
    }),
    refreshInterval: this.formBuilder.control(CLIPBOARD_VIEWER_DEFAULT_SETTINGS.refreshInterval, {
      nonNullable: true
    }),
    showMetadata: this.formBuilder.control(CLIPBOARD_VIEWER_DEFAULT_SETTINGS.showMetadata, {
      nonNullable: true
    }),
    wordWrap: this.formBuilder.control(CLIPBOARD_VIEWER_DEFAULT_SETTINGS.wordWrap, {
      nonNullable: true
    }),
    fontSize: this.formBuilder.control(CLIPBOARD_VIEWER_DEFAULT_SETTINGS.fontSize, {
      nonNullable: true
    })
  });

  readonly clipboardContent = signal<ClipboardContent | null>(null);
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly isRefreshing = signal(false);
  readonly lastUpdate = signal<number | null>(null);
  readonly dismissedSuggestionId = signal<string | null>(null);

  private readonly showMetadataEnabled = toSignal(
    this.form.controls.showMetadata.valueChanges.pipe(
      startWith(this.form.controls.showMetadata.value)
    ),
    { initialValue: this.form.controls.showMetadata.value }
  );

  private readonly wordWrapEnabled = toSignal(
    this.form.controls.wordWrap.valueChanges.pipe(startWith(this.form.controls.wordWrap.value)),
    { initialValue: this.form.controls.wordWrap.value }
  );

  private readonly fontSizePx = toSignal(
    this.form.controls.fontSize.valueChanges.pipe(startWith(this.form.controls.fontSize.value)),
    { initialValue: this.form.controls.fontSize.value }
  );

  private readonly refreshIntervalMs = toSignal(
    this.form.controls.refreshInterval.valueChanges.pipe(
      startWith(this.form.controls.refreshInterval.value)
    ),
    { initialValue: this.form.controls.refreshInterval.value }
  );

  readonly hasContent = computed(() => this.clipboardContent() !== null);
  readonly contentText = computed(() => this.clipboardContent()?.text ?? '');
  readonly contentMetadata = computed(() => this.clipboardContent()?.metadata);
  readonly clipboardSupported = computed(() => isClipboardViewerSupported(this.isBrowser));
  readonly showMetadata = computed(() => this.showMetadataEnabled());
  readonly wordWrap = computed(() => this.wordWrapEnabled());
  readonly fontSize = computed(() => this.fontSizePx());

  readonly statusLabel = computed(() => {
    if (this.isRefreshing()) {
      return '…';
    }
    return this.hasContent() ? 'Ready' : '—';
  });

  readonly primarySuggestion = computed<CftToolSuggestion | null>(() => {
    const suggestion = resolveClipboardViewerSuggestion(
      this.clipboardSupported(),
      this.clipboardContent()
    );
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  ngOnInit(): void {
    void this.readClipboard();

    this.form.controls.autoRefresh.valueChanges
      .pipe(
        startWith(this.form.controls.autoRefresh.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((enabled) => {
        if (enabled) {
          this.form.controls.refreshInterval.enable({ emitEvent: false });
          this.startAutoRefresh();
        } else {
          this.form.controls.refreshInterval.disable({ emitEvent: false });
          this.stopAutoRefresh();
        }
      });

    this.form.controls.refreshInterval.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.form.controls.autoRefresh.value) {
          this.startAutoRefresh();
        }
      });
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  async readClipboard(): Promise<void> {
    if (!this.clipboardSupported()) {
      this.errors.set(['Clipboard API is not supported in this browser.']);
      return;
    }

    this.isRefreshing.set(true);
    try {
      const text = await navigator.clipboard.readText();
      const content = processClipboardContent(text);
      this.clipboardContent.set(content);
      this.lastUpdate.set(Date.now());
      this.errors.set([]);
    } catch (error) {
      const errorMessage = (error as Error)?.message ?? 'Unknown error';
      if (shouldTreatClipboardErrorAsEmpty(errorMessage)) {
        this.clipboardContent.set(createEmptyClipboardContent());
      } else {
        this.errors.set(mapClipboardPermissionErrors(errorMessage));
      }
    } finally {
      this.isRefreshing.set(false);
    }
  }

  copyOutput(): void {
    const text = this.contentText();
    if (text) {
      void this.copyToClipboard(text);
    }
  }

  async copyToClipboard(text: string): Promise<void> {
    const copied = await cftCopyText(this.toast, text, 'Clipboard content');
    if (!copied) {
      this.errors.set(['Failed to copy to clipboard.']);
      return;
    }
    await this.readClipboard();
  }

  downloadContent(): void {
    const content = this.clipboardContent();
    if (!content || !content.text) {
      return;
    }

    try {
      const extension = getClipboardFileExtension(content.type);
      const blob = new Blob([content.text], { type: getClipboardMimeType(content.type) });
      cftDownloadBlob(blob, `clipboard-content-${Date.now()}${extension}`);
      this.toast.success('Clipboard content downloaded');
    } catch {
      this.toast.error('Could not download clipboard content');
    }
  }

  clearContent(): void {
    this.clipboardContent.set(null);
    this.errors.set([]);
    this.warnings.set([]);
    this.toast.info('Clipboard view cleared');
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    if (!this.isBrowser) {
      return;
    }
    if (!navigator.clipboard) {
      this.warnings.set(['Clipboard API not supported. Auto-refresh disabled.']);
      return;
    }

    const interval = this.refreshIntervalMs();
    this.refreshIntervalId = setInterval(() => {
      void this.readClipboard();
    }, interval);
  }

  private stopAutoRefresh(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }
}

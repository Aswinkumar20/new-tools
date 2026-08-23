import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

interface ClipboardContent {
  text: string;
  timestamp: number;
  length: number;
  type: 'text' | 'url' | 'code' | 'html' | 'image' | 'empty';
  preview: string;
  metadata: {
    lines: number;
    words: number;
    characters: number;
    isUrl: boolean;
    isCode: boolean;
    isHtml: boolean;
  };
}

type ViewerFormGroup = FormGroup<{
  autoRefresh: FormControl<boolean>;
  refreshInterval: FormControl<number>;
  showMetadata: FormControl<boolean>;
  wordWrap: FormControl<boolean>;
  fontSize: FormControl<number>;
}>;

const DEFAULT_REFRESH_INTERVAL = 1000; // 1 second
const MIN_REFRESH_INTERVAL = 100; // 100ms
const MAX_REFRESH_INTERVAL = 10000; // 10 seconds

@Component({
  selector: 'lib-clipboard-viewer',
  standalone: true,
  templateUrl: './clipboard-viewer.html',
  styleUrls: ['./clipboard-viewer.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClipboardViewerComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private refreshInterval: any = null;

  readonly form: ViewerFormGroup = this.fb.group({
    autoRefresh: this.fb.control(true, { nonNullable: true }),
    refreshInterval: this.fb.control(DEFAULT_REFRESH_INTERVAL, { nonNullable: true }),
    showMetadata: this.fb.control(true, { nonNullable: true }),
    wordWrap: this.fb.control(true, { nonNullable: true }),
    fontSize: this.fb.control(14, { nonNullable: true })
  });

  readonly clipboardContent = signal<ClipboardContent | null>(null);
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly isRefreshing = signal(false);
  readonly lastUpdate = signal<number | null>(null);

  readonly hasContent = computed(() => this.clipboardContent() !== null);
  readonly contentText = computed(() => this.clipboardContent()?.text ?? '');
  readonly contentMetadata = computed(() => this.clipboardContent()?.metadata);
  readonly clipboardSupported = computed(() => !!navigator.clipboard);
  readonly refreshIntervalMs = computed(() => this.form.controls.refreshInterval.value);

  ngOnInit(): void {
    // Initial read
    this.readClipboard();

    // Start auto-refresh if enabled
    if (this.form.controls.autoRefresh.value) {
      this.startAutoRefresh();
    }

    // Watch for auto-refresh changes
    this.form.controls.autoRefresh.valueChanges.subscribe(enabled => {
      if (enabled) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    });

    // Watch for refresh interval changes
    this.form.controls.refreshInterval.valueChanges.subscribe(() => {
      if (this.form.controls.autoRefresh.value) {
        this.startAutoRefresh();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    if (!navigator.clipboard) {
      this.warnings.set(['Clipboard API not supported. Auto-refresh disabled.']);
      return;
    }

    const interval = this.refreshIntervalMs();
    this.refreshInterval = setInterval(() => {
      this.readClipboard();
    }, interval);
  }

  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  async readClipboard(): Promise<void> {
    if (!navigator.clipboard) {
      this.errors.set(['Clipboard API is not supported in this browser.']);
      return;
    }

    this.isRefreshing.set(true);
    try {
      // Try to read text
      const text = await navigator.clipboard.readText();
      const content = this.processContent(text);
      this.clipboardContent.set(content);
      this.lastUpdate.set(Date.now());
      this.errors.set([]);
    } catch (error) {
      const errorMessage = (error as Error)?.message ?? 'Unknown error';
      if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
        this.errors.set([
          'Clipboard access denied.',
          'Please grant clipboard permissions or click "Read Clipboard" to manually read.'
        ]);
      } else if (errorMessage.includes('empty')) {
        this.clipboardContent.set({
          text: '',
          timestamp: Date.now(),
          length: 0,
          type: 'empty',
          preview: '',
          metadata: {
            lines: 0,
            words: 0,
            characters: 0,
            isUrl: false,
            isCode: false,
            isHtml: false
          }
        });
      } else {
        this.errors.set([`Failed to read clipboard: ${errorMessage}`]);
      }
    } finally {
      this.isRefreshing.set(false);
    }
  }

  private processContent(text: string): ClipboardContent {
    const trimmed = text.trim();
    const lines = text.split('\n');
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const characters = text.length;

    let type: ClipboardContent['type'] = 'text';
    let preview = text.substring(0, 200);

    // Detect type
    if (trimmed.length === 0) {
      type = 'empty';
      preview = '';
    } else if (/^https?:\/\/.+/.test(trimmed)) {
      type = 'url';
      preview = trimmed;
    } else if (/<[^>]+>/.test(text) || text.includes('<!DOCTYPE') || text.includes('<html')) {
      type = 'html';
      preview = text.substring(0, 200);
    } else if (/[{}();=]/.test(text) || text.includes('function') || text.includes('const ') || text.includes('var ') || text.includes('import ')) {
      type = 'code';
      preview = text.substring(0, 200);
    }

    return {
      text,
      timestamp: Date.now(),
      length: characters,
      type,
      preview,
      metadata: {
        lines: lines.length,
        words,
        characters,
        isUrl: type === 'url',
        isCode: type === 'code',
        isHtml: type === 'html'
      }
    };
  }

  async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      // Success feedback could be shown here
      this.readClipboard(); // Refresh after copy
    } catch (error) {
      this.errors.set([`Failed to copy to clipboard: ${(error as Error)?.message ?? 'Unknown error'}`]);
    }
  }

  downloadContent(): void {
    const content = this.clipboardContent();
    if (!content || !content.text) {
      return;
    }

    const extension = this.getFileExtension(content.type);
    const blob = new Blob([content.text], { type: this.getMimeType(content.type) });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `clipboard-content-${Date.now()}${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private getFileExtension(type: ClipboardContent['type']): string {
    switch (type) {
      case 'html':
        return '.html';
      case 'code':
        return '.txt';
      case 'url':
        return '.txt';
      default:
        return '.txt';
    }
  }

  private getMimeType(type: ClipboardContent['type']): string {
    switch (type) {
      case 'html':
        return 'text/html';
      default:
        return 'text/plain';
    }
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  formatBytes(value: number): string {
    if (value === 0) {
      return '0 B';
    }
    const UNITS = ['B', 'KB', 'MB'];
    const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), UNITS.length - 1);
    const scaled = value / Math.pow(1024, exponent);
    return `${scaled.toFixed(scaled >= 10 || exponent === 0 ? 0 : 1)} ${UNITS[exponent]}`;
  }

  clearContent(): void {
    this.clipboardContent.set(null);
    this.errors.set([]);
    this.warnings.set([]);
  }
}

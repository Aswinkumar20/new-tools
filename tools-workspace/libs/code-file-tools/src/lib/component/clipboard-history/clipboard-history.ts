import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface ClipboardEntry {
  id: string;
  text: string;
  timestamp: number;
  preview: string;
  length: number;
  type: 'text' | 'url' | 'code' | 'other';
}

type SettingsFormGroup = FormGroup<{
  autoMonitor: FormControl<boolean>;
  maxEntries: FormControl<number>;
  excludeDuplicates: FormControl<boolean>;
  minLength: FormControl<number>;
  maxLength: FormControl<number>;
}>;

const STORAGE_KEY = 'clipboard_history';
const SETTINGS_KEY = 'clipboard_history_settings';
const DEFAULT_MAX_ENTRIES = 50;
const POLL_INTERVAL = 1000; // Check clipboard every second

@Component({
  selector: 'lib-clipboard-history',
  standalone: true,
  templateUrl: './clipboard-history.html',
  styleUrls: ['./clipboard-history.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClipboardHistoryComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);
  private pollInterval: any = null;
  private lastClipboardText = '';

  readonly form: SettingsFormGroup = this.fb.group({
    autoMonitor: this.fb.control(true, { nonNullable: true }),
    maxEntries: this.fb.control(DEFAULT_MAX_ENTRIES, { nonNullable: true }),
    excludeDuplicates: this.fb.control(true, { nonNullable: true }),
    minLength: this.fb.control(1, { nonNullable: true }),
    maxLength: this.fb.control(100000, { nonNullable: true })
  });

  readonly history = signal<ClipboardEntry[]>([]);
  readonly searchQuery = signal<string>('');
  readonly selectedEntry = signal<ClipboardEntry | null>(null);
  readonly errors = signal<string[]>([]);
  readonly copySuccess = signal<string | null>(null);

  readonly filteredHistory = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const entries = this.history();
    if (!query) {
      return entries;
    }
    return entries.filter(entry => 
      entry.text.toLowerCase().includes(query) ||
      entry.preview.toLowerCase().includes(query)
    );
  });

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly totalEntries = computed(() => this.history().length);
  readonly clipboardSupported = computed(() => !!navigator.clipboard);

  ngOnInit(): void {
    this.loadHistory();
    this.loadSettings();
    
    // Start monitoring if auto-monitor is enabled
    if (this.form.controls.autoMonitor.value) {
      this.startMonitoring();
    }

    // Watch for settings changes
    this.form.controls.autoMonitor.valueChanges.subscribe(enabled => {
      if (enabled) {
        this.startMonitoring();
      } else {
        this.stopMonitoring();
      }
    });

    this.form.valueChanges.subscribe(() => {
      this.saveSettings();
    });
  }

  ngOnDestroy(): void {
    this.stopMonitoring();
  }

  private startMonitoring(): void {
    this.stopMonitoring();
    if (!navigator.clipboard) {
      this.errors.set(['Clipboard API not supported in this browser.']);
      return;
    }

    this.pollInterval = setInterval(() => {
      this.checkClipboard();
    }, POLL_INTERVAL);
  }

  private stopMonitoring(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async checkClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text !== this.lastClipboardText) {
        this.lastClipboardText = text;
        this.addToHistory(text);
      }
    } catch (error) {
      // Silently handle clipboard read errors (permissions, etc.)
    }
  }

  async addToHistory(text: string): Promise<void> {
    const settings = this.form.getRawValue();
    
    // Validate length
    if (text.length < settings.minLength || text.length > settings.maxLength) {
      return;
    }

    // Check for duplicates
    if (settings.excludeDuplicates) {
      const exists = this.history().some(entry => entry.text === text);
      if (exists) {
        return;
      }
    }

    const entry: ClipboardEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      timestamp: Date.now(),
      preview: this.getPreview(text),
      length: text.length,
      type: this.detectType(text)
    };

    this.history.update(entries => {
      const newEntries = [entry, ...entries];
      // Limit to max entries
      return newEntries.slice(0, settings.maxEntries);
    });

    this.saveHistory();
  }

  private getPreview(text: string, maxLength: number = 100): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  private detectType(text: string): 'text' | 'url' | 'code' | 'other' {
    // URL detection
    if (/^https?:\/\/.+/.test(text.trim())) {
      return 'url';
    }
    // Code detection (contains common code patterns)
    if (/[{}();=]/.test(text) || text.includes('function') || text.includes('const ') || text.includes('var ')) {
      return 'code';
    }
    return 'text';
  }

  copySelected(): void {
    const entry = this.selectedEntry();
    if (entry) {
      this.copyToClipboard(entry);
    }
  }

  async copyToClipboard(entry: ClipboardEntry): Promise<void> {
    try {
      await navigator.clipboard.writeText(entry.text);
      this.copySuccess.set(entry.id);
      setTimeout(() => this.copySuccess.set(null), 2000);
      
      // Move to top of history
      this.history.update(entries => {
        const filtered = entries.filter(e => e.id !== entry.id);
        return [{ ...entry, timestamp: Date.now() }, ...filtered];
      });
      this.saveHistory();
    } catch (error) {
      this.errors.set([`Failed to copy to clipboard: ${(error as Error)?.message ?? 'Unknown error'}`]);
    }
  }

  async manualAdd(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        await this.addToHistory(text);
      }
    } catch (error) {
      this.errors.set([`Failed to read clipboard: ${(error as Error)?.message ?? 'Unknown error'}`]);
    }
  }

  selectEntry(entry: ClipboardEntry): void {
    this.selectedEntry.set(entry);
  }

  removeEntry(id: string): void {
    this.history.update(entries => entries.filter(e => e.id !== id));
    this.saveHistory();
    if (this.selectedEntry()?.id === id) {
      this.selectedEntry.set(null);
    }
  }

  clearHistory(): void {
    this.history.set([]);
    this.selectedEntry.set(null);
    this.saveHistory();
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
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

  formatBytes(value: number): string {
    if (value === 0) {
      return '0 B';
    }
    const UNITS = ['B', 'KB', 'MB'];
    const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), UNITS.length - 1);
    const scaled = value / Math.pow(1024, exponent);
    return `${scaled.toFixed(scaled >= 10 || exponent === 0 ? 0 : 1)} ${UNITS[exponent]}`;
  }

  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const entries = JSON.parse(stored) as ClipboardEntry[];
        this.history.set(entries);
      }
    } catch (error) {
      console.error('Failed to load clipboard history:', error);
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history()));
    } catch (error) {
      console.error('Failed to save clipboard history:', error);
      this.errors.set(['Failed to save history. Storage may be full.']);
    }
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        this.form.patchValue(settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.form.getRawValue()));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

type StorageType = 'local' | 'session';

interface StorageEntry {
  key: string;
  value: string;
  bytes: number;
}

interface StorageInfo {
  usedBytes: number | null;
  quotaBytes: number | null;
}

type StorageViewerFormGroup = FormGroup<{
  storageType: FormControl<StorageType>;
  filter: FormControl<string>;
  key: FormControl<string>;
  value: FormControl<string>;
}>;

@Component({
  selector: 'lib-storage-viewer',
  standalone: true,
  templateUrl: './storage-viewer.html',
  styleUrls: ['./storage-viewer.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StorageViewerComponent {
  private readonly fb = inject(FormBuilder);

  readonly form: StorageViewerFormGroup = this.fb.group({
    storageType: this.fb.control<StorageType>('local', { nonNullable: true }),
    filter: this.fb.control('', { nonNullable: true }),
    key: this.fb.control('', { nonNullable: true }),
    value: this.fb.control('', { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly entries = signal<StorageEntry[]>([]);
  readonly storageInfo = signal<StorageInfo>({ usedBytes: null, quotaBytes: null });

  readonly filteredEntries = computed(() => {
    const filter = this.form.controls.filter.value.toLowerCase().trim();
    if (!filter) {
      return this.entries();
    }
    return this.entries().filter(
      (e) => e.key.toLowerCase().includes(filter) || e.value.toLowerCase().includes(filter)
    );
  });

  readonly hasEntries = computed(() => this.entries().length > 0);

  constructor() {
    this.refresh();
    this.estimateStorage();
  }

  get currentStorage(): Storage {
    return this.form.controls.storageType.value === 'local' ? window.localStorage : window.sessionStorage;
  }

  refresh(): void {
    this.errors.set([]);
    try {
      const storage = this.currentStorage;
      const entries: StorageEntry[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key === null) continue;
        const value = storage.getItem(key) ?? '';
        const bytes = new Blob([value]).size;
        entries.push({ key, value, bytes });
      }
      this.entries.set(entries.sort((a, b) => a.key.localeCompare(b.key)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error while reading storage.';
      this.errors.set([`Failed to read storage: ${msg}`]);
      this.entries.set([]);
    }
  }

  clearStorage(): void {
    this.errors.set([]);
    try {
      this.currentStorage.clear();
      this.entries.set([]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error while clearing storage.';
      this.errors.set([`Failed to clear storage: ${msg}`]);
    }
  }

  loadEntry(entry: StorageEntry): void {
    this.form.controls.key.setValue(entry.key);
    this.form.controls.value.setValue(entry.value);
  }

  saveEntry(): void {
    this.errors.set([]);
    const key = this.form.controls.key.value.trim();
    const value = this.form.controls.value.value;
    if (!key) {
      this.errors.set(['Key cannot be empty.']);
      return;
    }
    try {
      this.currentStorage.setItem(key, value);
      this.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error while saving value.';
      this.errors.set([`Failed to save item: ${msg}`]);
    }
  }

  removeEntry(key: string): void {
    this.errors.set([]);
    try {
      this.currentStorage.removeItem(key);
      this.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error while removing value.';
      this.errors.set([`Failed to remove item: ${msg}`]);
    }
  }

  formatBytes(bytes: number | null): string {
    if (bytes === null) return 'N/A';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  private async estimateStorage(): Promise<void> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        this.storageInfo.set({
          usedBytes: estimate.usage ?? null,
          quotaBytes: estimate.quota ?? null
        });
      } catch {
        // ignore
      }
    }
  }
}

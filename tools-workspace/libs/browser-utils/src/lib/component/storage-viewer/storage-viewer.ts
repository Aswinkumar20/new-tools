import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  inject,
  signal
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { startWith } from 'rxjs/operators';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { buCopyText } from '../../shared/bu-clipboard.util';
import { buDownloadJson, buDownloadTimestamp } from '../../shared/bu-download.util';
import {
  STORAGE_DEFAULT_TYPE,
  STORAGE_RELATED_TOOLS
} from '../../constants/storage-viewer.constants';
import type { BuRelatedToolLink, BuToolSuggestion } from '../../shared/bu-tool-suggestion.model';
import type { StorageEntry, StorageInfo, StorageType } from '../../types/storage-viewer.types';
import {
  filterStorageEntries,
  formatStorageBytes,
  formatStorageTypeLabel,
  mapStorageEstimate,
  readStorageEntries,
  resolveStorageSuggestion,
  serializeAllStorageEntries,
  serializeStorageLine
} from '../../utils/storage-viewer.utils';

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
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StorageViewerComponent {
  private readonly formBuilder = inject(FormBuilder);
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly relatedTools: ReadonlyArray<BuRelatedToolLink> = STORAGE_RELATED_TOOLS;
  readonly formatBytes = formatStorageBytes;

  readonly form: StorageViewerFormGroup = this.formBuilder.group({
    storageType: this.formBuilder.control<StorageType>(STORAGE_DEFAULT_TYPE, { nonNullable: true }),
    filter: this.formBuilder.control('', { nonNullable: true }),
    key: this.formBuilder.control('', { nonNullable: true }),
    value: this.formBuilder.control('', { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly entries = signal<StorageEntry[]>([]);
  readonly storageInfo = signal<StorageInfo>({ usedBytes: null, quotaBytes: null });
  readonly dismissedSuggestionId = signal<string | null>(null);

  private readonly filterQuery = toSignal(
    this.form.controls.filter.valueChanges.pipe(startWith(this.form.controls.filter.value)),
    { initialValue: this.form.controls.filter.value }
  );

  private readonly storageTypeValue = toSignal(
    this.form.controls.storageType.valueChanges.pipe(
      startWith(this.form.controls.storageType.value)
    ),
    { initialValue: this.form.controls.storageType.value }
  );

  private readonly editorValue = toSignal(
    this.form.controls.value.valueChanges.pipe(startWith(this.form.controls.value.value)),
    { initialValue: this.form.controls.value.value }
  );

  readonly filteredEntries = computed(() =>
    filterStorageEntries(this.entries(), this.filterQuery())
  );

  readonly hasEntries = computed(() => this.entries().length > 0);

  readonly storageTypeLabel = computed(() => formatStorageTypeLabel(this.storageTypeValue()));

  readonly primarySuggestion = computed<BuToolSuggestion | null>(() => {
    const suggestion = resolveStorageSuggestion(
      this.editorValue(),
      this.entries().length,
      this.storageTypeValue()
    );
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.refresh();
    void this.estimateStorage();
  }

  get currentStorage(): Storage {
    return this.form.controls.storageType.value === 'local'
      ? window.localStorage
      : window.sessionStorage;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  refresh(): void {
    this.errors.set([]);
    if (!this.isBrowser) {
      this.entries.set([]);
      return;
    }

    try {
      this.entries.set(readStorageEntries(this.currentStorage));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error while reading storage.';
      this.errors.set([`Failed to read storage: ${message}`]);
      this.entries.set([]);
    }
  }

  clearStorage(): void {
    this.errors.set([]);
    if (!this.isBrowser) {
      return;
    }

    try {
      this.currentStorage.clear();
      this.entries.set([]);
      this.toast.info('Storage cleared');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error while clearing storage.';
      this.errors.set([`Failed to clear storage: ${message}`]);
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
    if (!this.isBrowser) {
      return;
    }

    try {
      this.currentStorage.setItem(key, value);
      this.refresh();
      this.toast.success('Storage entry saved');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error while saving value.';
      this.errors.set([`Failed to save item: ${message}`]);
    }
  }

  removeEntry(key: string): void {
    this.errors.set([]);
    if (!this.isBrowser) {
      return;
    }

    try {
      this.currentStorage.removeItem(key);
      this.refresh();
      this.toast.info('Storage entry removed');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error while removing value.';
      this.errors.set([`Failed to remove item: ${message}`]);
    }
  }

  clearEditor(): void {
    this.form.controls.key.setValue('');
    this.form.controls.value.setValue('');
  }

  copyEntry(entry: StorageEntry): void {
    buCopyText(this.toast, serializeStorageLine(entry), entry.key);
  }

  copyEditorValue(): void {
    const value = this.form.controls.value.value;
    if (!value) return;
    buCopyText(this.toast, value, 'Storage value');
  }

  copyAllEntries(): void {
    buCopyText(this.toast, serializeAllStorageEntries(this.entries()), 'All storage entries');
  }

  downloadJson(): void {
    try {
      buDownloadJson(
        {
          storageType: this.storageTypeValue(),
          entries: this.entries(),
          estimatedUsage: this.storageInfo()
        },
        `storage-${this.storageTypeValue()}-${buDownloadTimestamp()}.json`
      );
      this.toast.success('Storage dump downloaded');
    } catch {
      this.toast.error('Could not download storage dump');
    }
  }

  private async estimateStorage(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        this.storageInfo.set(mapStorageEstimate(estimate));
      } catch {
        // Storage estimate is optional and may be unavailable.
      }
    }
  }
}

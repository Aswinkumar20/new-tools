import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { cftCopyText } from '../../shared/cft-clipboard.util';
import { cftDownloadBlob, cftDownloadJson, cftDownloadTimestamp } from '../../shared/cft-download.util';
import type { CftRelatedToolLink, CftToolSuggestion } from '../../shared/cft-tool-suggestion.model';
import { FILE_METADATA_RELATED_TOOLS } from '../../constants/file-metadata-viewer.constants';
import type { FileMetadata } from '../../types/file-metadata-viewer.types';
import {
  extractFileMetadata,
  formatFileMetadataDate,
  formatFileMetadataSize,
  formatFileMetadataText,
  getAdditionalInfoItems,
  getFileIcon,
  getFileTypeLabel,
  resolveFileMetadataSuggestion
} from '../../utils/file-metadata-viewer.utils';

@Component({
  selector: 'lib-file-metadata-viewer',
  standalone: true,
  templateUrl: './file-metadata-viewer.html',
  styleUrls: ['./file-metadata-viewer.scss'],
  imports: [RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileMetadataViewerComponent {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  readonly relatedTools: ReadonlyArray<CftRelatedToolLink> = FILE_METADATA_RELATED_TOOLS;
  readonly formatFileSize = formatFileMetadataSize;
  readonly formatDate = formatFileMetadataDate;
  readonly getFileTypeLabel = getFileTypeLabel;
  readonly getFileIcon = getFileIcon;
  readonly getAdditionalInfoItems = getAdditionalInfoItems;

  readonly files = signal<FileMetadata[]>([]);
  readonly selectedFile = signal<FileMetadata | null>(null);
  readonly errors = signal<string[]>([]);
  readonly isDragOver = signal(false);
  readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasFiles = computed(() => this.files().length > 0);
  readonly totalSize = computed(() => this.files().reduce((sum, file) => sum + file.size, 0));

  readonly metadataText = computed(() => {
    const file = this.selectedFile();
    return file ? formatFileMetadataText(file) : '';
  });

  readonly primarySuggestion = computed<CftToolSuggestion | null>(() => {
    const suggestion = resolveFileMetadataSuggestion(this.selectedFile(), this.files().length);
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      void this.processFiles(Array.from(droppedFiles));
    }
  }

  onFileInputChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      return this.processFiles(Array.from(input.files));
    }
    return Promise.resolve();
  }

  selectFile(metadata: FileMetadata): void {
    this.selectedFile.set(metadata);
  }

  removeFile(metadata: FileMetadata): void {
    this.files.update((files) => files.filter((file) => file !== metadata));
    if (this.selectedFile() === metadata) {
      const remaining = this.files();
      this.selectedFile.set(remaining.length > 0 ? remaining[0] : null);
    }
  }

  clearAll(): void {
    this.files.set([]);
    this.selectedFile.set(null);
    this.errors.set([]);
    this.toast.info('Files cleared');
  }

  downloadFile(metadata: FileMetadata): void {
    try {
      cftDownloadBlob(metadata.file, metadata.name);
      this.toast.success('File download started');
    } catch {
      this.toast.error('Could not download file');
    }
  }

  downloadMetadataJson(): void {
    const file = this.selectedFile();
    if (!file) {
      return;
    }

    try {
      cftDownloadJson(
        {
          name: file.name,
          size: file.size,
          type: file.type,
          mimeType: file.mimeType,
          extension: file.extension,
          lastModified: file.lastModified,
          dimensions: file.dimensions ?? null,
          additionalInfo: file.additionalInfo ?? null,
          metadataText: formatFileMetadataText(file)
        },
        `file-metadata-${cftDownloadTimestamp()}.json`
      );
      this.toast.success('Metadata JSON downloaded');
    } catch {
      this.toast.error('Could not download metadata JSON');
    }
  }

  copyMetadata(): void {
    const text = this.metadataText();
    if (!text) {
      return;
    }
    void cftCopyText(this.toast, text, 'File metadata');
  }

  private async processFiles(fileList: File[]): Promise<void> {
    this.errors.set([]);
    const newFiles: FileMetadata[] = [];

    for (const file of fileList) {
      try {
        const metadata = await extractFileMetadata(file);
        newFiles.push(metadata);
      } catch (error) {
        this.errors.update((errors) => [
          ...errors,
          `Failed to process ${file.name}: ${(error as Error)?.message ?? 'Unknown error'}`
        ]);
      }
    }

    if (newFiles.length > 0) {
      this.files.update((files) => [...newFiles, ...files]);
      if (!this.selectedFile()) {
        this.selectedFile.set(newFiles[0]);
      }
      this.toast.info(
        newFiles.length === 1 ? 'File loaded' : `${newFiles.length} files loaded`
      );
    }
  }
}

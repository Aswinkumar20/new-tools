import { ChangeDetectionStrategy, Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface FileMetadata {
  file: File;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  extension: string;
  mimeType: string;
  preview?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  additionalInfo?: {
    [key: string]: any;
  };
}

@Component({
  selector: 'lib-file-metadata-viewer',
  standalone: true,
  templateUrl: './file-metadata-viewer.html',
  styleUrls: ['./file-metadata-viewer.scss'],
  imports: [CommonModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileMetadataViewerComponent {
  readonly assetService = inject(AssetService);

  readonly files = signal<FileMetadata[]>([]);
  readonly selectedFile = signal<FileMetadata | null>(null);
  readonly errors = signal<string[]>([]);
  readonly isDragOver = signal(false);

  readonly hasFiles = computed(() => this.files().length > 0);
  readonly totalSize = computed(() => 
    this.files().reduce((sum, file) => sum + file.size, 0)
  );

  readonly metadataText = computed(() => {
    const file = this.selectedFile();
    if (!file) {
      return '';
    }
    const lines = [
      `Name: ${file.name}`,
      `Size: ${this.formatFileSize(file.size)}`,
      `Type: ${this.getFileTypeLabel(file.mimeType)}`,
      `MIME: ${file.mimeType}`,
      `Extension: ${file.extension || 'None'}`,
      `Last modified: ${this.formatDate(file.lastModified)}`
    ];
    if (file.dimensions) {
      lines.push(`Dimensions: ${file.dimensions.width} × ${file.dimensions.height} px`);
    }
    if (file.additionalInfo) {
      for (const item of this.getAdditionalInfoItems(file.additionalInfo)) {
        lines.push(`${item.label}: ${item.value}`);
      }
    }
    return lines.join('\n');
  });

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
      this.processFiles(Array.from(droppedFiles));
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFiles(Array.from(input.files));
    }
  }

  private async processFiles(fileList: File[]): Promise<void> {
    this.errors.set([]);
    const newFiles: FileMetadata[] = [];

    for (const file of fileList) {
      try {
        const metadata = await this.extractMetadata(file);
        newFiles.push(metadata);
      } catch (error) {
        this.errors.update(errors => [
          ...errors,
          `Failed to process ${file.name}: ${(error as Error)?.message ?? 'Unknown error'}`
        ]);
      }
    }

    if (newFiles.length > 0) {
      this.files.update(files => [...newFiles, ...files]);
      if (!this.selectedFile()) {
        this.selectedFile.set(newFiles[0]);
      }
    }
  }

  private async extractMetadata(file: File): Promise<FileMetadata> {
    const extension = this.getFileExtension(file.name);
    const metadata: FileMetadata = {
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      lastModified: file.lastModified,
      extension,
      mimeType: file.type || this.getMimeTypeFromExtension(extension),
      additionalInfo: {}
    };

    // Extract image dimensions if it's an image
    if (file.type.startsWith('image/')) {
      try {
        const dimensions = await this.getImageDimensions(file);
        metadata.dimensions = dimensions;
        metadata.preview = await this.createImagePreview(file);
      } catch (error) {
        // Ignore image processing errors
      }
    }

    // Extract additional metadata based on file type
    if (file.type.startsWith('text/') || file.type === 'application/json') {
      try {
        const text = await file.text();
        metadata.additionalInfo = {
          lines: text.split('\n').length,
          characters: text.length,
          words: text.trim() ? text.trim().split(/\s+/).length : 0
        };
      } catch (error) {
        // Ignore text reading errors
      }
    }

    return metadata;
  }

  private getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    });
  }

  private createImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to create preview'));
      reader.readAsDataURL(file);
    });
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      'txt': 'text/plain',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'pdf': 'application/pdf',
      'zip': 'application/zip',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav'
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  selectFile(metadata: FileMetadata): void {
    this.selectedFile.set(metadata);
  }

  removeFile(metadata: FileMetadata): void {
    this.files.update(files => files.filter(f => f !== metadata));
    if (this.selectedFile() === metadata) {
      const remaining = this.files();
      this.selectedFile.set(remaining.length > 0 ? remaining[0] : null);
    }
  }

  clearAll(): void {
    this.files.set([]);
    this.selectedFile.set(null);
    this.errors.set([]);
  }

  downloadFile(metadata: FileMetadata): void {
    const url = URL.createObjectURL(metadata.file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = metadata.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  copyMetadata(): void {
    const text = this.metadataText();
    if (text) {
      navigator.clipboard.writeText(text).catch(() => {
        this.errors.set(['Unable to copy metadata to clipboard.']);
      });
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }
    const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
    const scaled = bytes / Math.pow(1024, exponent);
    return `${scaled.toFixed(scaled >= 10 || exponent === 0 ? 0 : 1)} ${UNITS[exponent]}`;
  }

  formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  }

  getFileTypeLabel(mimeType: string): string {
    if (!mimeType || mimeType === 'application/octet-stream') {
      return 'Unknown';
    }
    const parts = mimeType.split('/');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  }

  getFileIcon(extension: string): string {
    const icons: { [key: string]: string } = {
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'png': '🖼️',
      'gif': '🖼️',
      'svg': '🖼️',
      'webp': '🖼️',
      'pdf': '📄',
      'doc': '📄',
      'docx': '📄',
      'txt': '📝',
      'html': '🌐',
      'css': '🎨',
      'js': '💻',
      'json': '📋',
      'xml': '📋',
      'zip': '📦',
      'rar': '📦',
      'mp4': '🎬',
      'mp3': '🎵',
      'wav': '🎵'
    };
    return icons[extension] || '📁';
  }

  getAdditionalInfoItems(additionalInfo: { [key: string]: any }): Array<{ key: string; label: string; value: string }> {
    const labels: { [key: string]: string } = {
      lines: 'Lines',
      characters: 'Characters',
      words: 'Words'
    };
    return Object.entries(additionalInfo).map(([key, value]) => ({
      key,
      label: labels[key] || key.charAt(0).toUpperCase() + key.slice(1),
      value: String(value)
    }));
  }
}

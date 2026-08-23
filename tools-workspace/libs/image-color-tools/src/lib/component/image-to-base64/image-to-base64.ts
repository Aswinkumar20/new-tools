import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

type OutputFormat = 'base64' | 'base64url' | 'text';

interface ConversionOptions {
  outputFormat: OutputFormat;
  wrapWidth: number | null;
  includeMime: boolean;
  chunkSize: number;
}

interface ConversionResult {
  dataUri: string;
  textPreview: string;
  size: number;
  encodedSize: number;
  compressionRatio: number;
  previewUrl: SafeUrl;
  filename: string | null;
  mime: string;
  outputFormat: OutputFormat;
  chunks: string[];
}

interface HistoryEntry {
  timestamp: number;
  filename: string | null;
  size: number;
  mime: string;
  format: OutputFormat;
  encodedLength: number;
}

type ImageFormGroup = FormGroup<{
  outputFormat: FormControl<OutputFormat>;
  wrapWidth: FormControl<number | null>;
  includeMime: FormControl<boolean>;
  chunkSize: FormControl<number>;
  rememberHistory: FormControl<boolean>;
}>;

const DEFAULT_WRAP_WIDTH = 76;
const DEFAULT_CHUNK_SIZE = 4096;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const FALLBACK_IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'icns',
  'tif',
  'tiff',
  'heic',
  'heif',
  'avif',
  'raw',
  'cr2',
  'nef',
  'arw',
  'dng'
]);

function wrapText(value: string, width: number | null): string {
  if (!width || width <= 0) {
    return value;
  }
  let output = '';
  for (let index = 0; index < value.length; index += width) {
    output += value.slice(index, index + width);
    if (index + width < value.length) {
      output += '\n';
    }
  }
  return output;
}

function chunkString(value: string, size: number): string[] {
  if (size <= 0) {
    return [value];
  }
  const result: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    result.push(value.slice(i, i + size));
  }
  return result;
}

@Component({
  selector: 'lib-image-to-base64',
  standalone: true,
  templateUrl: './image-to-base64.html',
  styleUrls: ['./image-to-base64.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageToBase64Component {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  readonly maxFileSize = MAX_FILE_SIZE;

  readonly form: ImageFormGroup = this.fb.group({
    outputFormat: this.fb.control<OutputFormat>('base64', { nonNullable: true }),
    wrapWidth: this.fb.control<number | null>(DEFAULT_WRAP_WIDTH),
    includeMime: this.fb.control<boolean>(true, { nonNullable: true }),
    chunkSize: this.fb.control<number>(DEFAULT_CHUNK_SIZE, { nonNullable: true, validators: [Validators.min(256)] }),
    rememberHistory: this.fb.control<boolean>(true, { nonNullable: true })
  });

  readonly selectedFile = signal<File | null>(null);
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly result: WritableSignal<ConversionResult | null> = signal(null);
  readonly history = signal<HistoryEntry[]>([]);
  readonly isProcessing = signal(false);
  readonly dragActive = signal(false);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly shareable = computed(() => {
    const current = this.result();
    return !!current && navigator.clipboard !== undefined;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.result()) {
        this.reprocess();
      }
    });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) {
      this.handleFile(file);
    }
  }

  handleFileInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input?.files?.length) {
      return;
    }
    const file = input.files[0];
    this.handleFile(file);
    input.value = '';
  }

  async handleFile(file: File): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);
    this.result.set(null);

    const mimeType = file.type ?? '';
    const isImageMime = mimeType.startsWith('image/');
    const extension = (file.name?.split('.').pop() ?? '').toLowerCase();
    const isKnownExtension = extension ? FALLBACK_IMAGE_EXTENSIONS.has(extension) : false;

    if (!isImageMime && !isKnownExtension) {
      this.errors.set([
        `Unsupported file type: ${mimeType || extension || 'unknown'}.`,
        'Only image files are supported. Please choose a file with an image MIME type or a common image extension.'
      ]);
      return;
    }

    if (!isImageMime && isKnownExtension) {
      this.warnings.set([`File lacks an image MIME type. Proceeding based on extension ".${extension}".`]);
    }

    if (file.size > MAX_FILE_SIZE) {
      this.errors.set([
        `File size ${formatBytes(file.size)} exceeds the ${formatBytes(MAX_FILE_SIZE)} limit.`,
        'Consider compressing the image or using an external optimizer before conversion.'
      ]);
      return;
    }

    this.selectedFile.set(file);
    await this.convertFile(file);
  }

  async convertFile(file: File): Promise<void> {
    this.isProcessing.set(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = this.arrayBufferToBase64(buffer);
      this.buildResult(file, base64);
    } catch (error) {
      this.errors.set([`Failed to process file: ${(error as Error)?.message ?? 'Unknown error.'}`]);
      this.result.set(null);
    } finally {
      this.isProcessing.set(false);
    }
  }

  reprocess(): void {
    const file = this.selectedFile();
    if (!file) {
      return;
    }
    this.convertFile(file);
  }

  async copyToClipboard(): Promise<void> {
    const current = this.result();
    if (!current) {
      return;
    }
    try {
      await navigator.clipboard.writeText(current.textPreview);
      this.warnings.set(['Copied encoded output to clipboard. Large outputs may be truncated depending on clipboard limits.']);
    } catch (error) {
      this.errors.set([`Unable to copy: ${(error as Error)?.message ?? 'Clipboard access denied.'}`]);
    }
  }

  downloadEncoded(): void {
    const current = this.result();
    if (!current) {
      return;
    }
    const blob = new Blob([current.textPreview], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${current.filename ?? 'image'}.${current.outputFormat === 'text' ? 'txt' : 'base64.txt'}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  clear(): void {
    this.selectedFile.set(null);
    this.result.set(null);
    this.errors.set([]);
    this.warnings.set([]);
  }

  applyHistory(entry: HistoryEntry): void {
    // No file to re-hydrate, but we can set metadata preview.
    this.warnings.set([`History entry: ${entry.filename ?? 'Untitled'} (${formatBytes(entry.size)}) · ${entry.mime}`]);
  }

  clearHistory(): void {
    this.history.set([]);
  }

  private buildResult(file: File, base64: string): void {
    const { outputFormat, wrapWidth, includeMime, chunkSize, rememberHistory } = this.form.getRawValue();
    const encoded = outputFormat === 'base64url' ? this.toBase64Url(base64) : base64;
    const wrapped = wrapText(encoded, wrapWidth ?? null);
    const shouldPrefix = includeMime && outputFormat === 'base64';
    const dataUri = shouldPrefix ? `data:${file.type};base64,${encoded}` : encoded;
    const textPreview = outputFormat === 'text' ? encoded : wrapped;
    const encodedBytes = new Blob([textPreview]).size;
    const ratio = encodedBytes / file.size;
    const previewUrl = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(file));

    const result: ConversionResult = {
      dataUri,
      textPreview,
      size: file.size,
      encodedSize: encodedBytes,
      compressionRatio: ratio,
      previewUrl,
      filename: file.name || null,
      mime: file.type,
      outputFormat,
      chunks: chunkString(encoded, Math.max(chunkSize, 256))
    };

    this.result.set(result);

    if (rememberHistory) {
      this.history.update((current) => [
        {
          timestamp: Date.now(),
          filename: result.filename,
          size: result.size,
          mime: result.mime,
          format: result.outputFormat,
          encodedLength: result.encodedSize
        },
        ...current
      ].slice(0, 8));
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder('iso-8859-1');
    return btoa(decoder.decode(bytes));
  }

  private toBase64Url(value: string): string {
    return value
      .split('+')
      .join('-')
      .split('/')
      .join('_')
      .replace(/=+$/, '');
  }

  formatBytes(value: number): string {
    return formatBytes(value);
  }
}

function formatBytes(value: number): string {
  if (value === 0) {
    return '0 B';
  }
  const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), UNITS.length - 1);
  const scaled = value / Math.pow(1024, exponent);
  return `${scaled.toFixed(scaled >= 10 || exponent === 0 ? 0 : 1)} ${UNITS[exponent]}`;
}

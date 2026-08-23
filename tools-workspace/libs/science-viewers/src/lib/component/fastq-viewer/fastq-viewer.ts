import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import {
  FASTQ_ACCEPT_ATTR,
  FASTQ_FORMATS_HINT,
  FASTQ_FORMATS_LABEL,
  FASTQ_RELATED_TOOLS,
  FASTQ_SUPPORTED_EXTENSIONS
} from '../../constants/fastq-viewer.constants';
import type {
  FastqEncoding,
  FastqExportFormat,
  FastqLoadedFile,
  FastqRead,
  FastqViewMode
} from '../../types/fastq-viewer.types';
import { canvasToPngDataUrl, drawHistogramToCanvas, drawLineChartToCanvas } from '../../utils/science-image-render.utils';
import {
  buildFastqMetadataRows,
  buildReadMetadataRows,
  canExportFastq,
  createFastqFileRecord,
  createSampleFastqFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportFastqReadsCsv,
  exportFastqSummaryJson,
  exportFilteredFastq,
  filterFastqReads,
  filterValidFastqFiles,
  formatFastqFileSize,
  qualityColor,
  qualityHistogramBars,
  readFastqFileBytes,
  residueColor,
  resolveFastqSuggestion,
  wrapSequence
} from '../../utils/fastq-viewer.utils';

@Component({
  selector: 'lib-fastq-viewer',
  standalone: true,
  templateUrl: './fastq-viewer.html',
  styleUrls: ['./fastq-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FastqViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = FASTQ_ACCEPT_ATTR;
  readonly relatedTools = FASTQ_RELATED_TOOLS;
  readonly supportedExtensions = FASTQ_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = FASTQ_FORMATS_LABEL;
  readonly formatsHint = FASTQ_FORMATS_HINT;
  readonly encodings: FastqEncoding[] = ['phred33', 'phred64'];
  readonly viewModes: Array<{ id: FastqViewMode; label: string }> = [
    { id: 'reads', label: 'Reads' },
    { id: 'quality', label: 'Quality profile' }
  ];

  files: FastqLoadedFile[] = [];
  currentIndex = -1;
  selectedReadIndex = 0;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  viewMode: FastqViewMode = 'reads';
  encoding: FastqEncoding = 'phred33';
  query = '';
  minLength = 0;
  minMeanQ = 0;
  colorize = true;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): FastqLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportFastq(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildFastqMetadataRows(this.parsed) : [];
  }

  get visibleReads(): FastqRead[] {
    if (!this.parsed) return [];
    return filterFastqReads(this.parsed.reads, this.query, this.minLength, this.minMeanQ);
  }

  get selectedRead(): FastqRead | null {
    return this.visibleReads[this.selectedReadIndex] ?? this.visibleReads[0] ?? null;
  }

  get readMetadataRows() {
    return this.selectedRead ? buildReadMetadataRows(this.selectedRead) : [];
  }

  get wrappedSeq() {
    return this.selectedRead ? wrapSequence(this.selectedRead.sequence, 50) : [];
  }

  get qualityBars() {
    return this.parsed ? qualityHistogramBars(this.parsed.qualityHistogram) : [];
  }

  get primarySuggestion() {
    const s = resolveFastqSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) this.observeCanvasResize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showExportMenu) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth += 1;
    if (!this.showDropZone) {
      this.showDropZone = true;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0 && this.showDropZone) {
      this.showDropZone = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:drop', ['$event'])
  async onWindowDrop(event: DragEvent): Promise<void> {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropZone = false;
    const files = event.dataTransfer?.files;
    if (files?.length) await this.handleFiles(Array.from(files));
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.isTypingTarget(event.target)) {
      if (event.key === 'Escape') (event.target as HTMLElement).blur();
      return;
    }
    if (!this.currentFile) return;
    if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectRead(Math.min(this.visibleReads.length - 1, this.selectedReadIndex + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectRead(Math.max(0, this.selectedReadIndex - 1));
    } else if (event.key.toLowerCase() === 'e') {
      event.preventDefault();
      this.setEncoding(this.encoding === 'phred33' ? 'phred64' : 'phred33');
    }
  }

  trackByFileId(_index: number, file: FastqLoadedFile): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  trackByRead(_index: number, read: FastqRead): string {
    return `${read.index}:${read.id}`;
  }

  trackByPos(index: number): number {
    return index;
  }

  scoreColor(q: number): string {
    return qualityColor(q);
  }

  baseStyle(ch: string): Record<string, string> {
    if (!this.colorize) return {};
    return { color: residueColor(ch, 'dna') };
  }

  formatSize(bytes: number): string {
    return formatFastqFileSize(bytes);
  }

  openFilePicker(): void {
    this.fileInput?.nativeElement?.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    await this.handleFiles(Array.from(input.files));
    input.value = '';
  }

  async handleFiles(files: File[]): Promise<void> {
    const { accepted, rejected } = filterValidFastqFiles(files);
    for (const item of rejected) this.toast.error(`${item.name}: ${item.reason}`);
    if (!accepted.length) {
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    try {
      for (const file of accepted) {
        try {
          const bytes = await readFastqFileBytes(file);
          const record = createFastqFileRecord(file, bytes);
          const existing = this.files.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.files[existing] = record;
            this.currentIndex = existing;
          } else {
            this.files = [...this.files, record];
            this.currentIndex = this.files.length - 1;
          }
          this.selectedReadIndex = 0;
          this.encoding = record.parsed?.encoding ?? 'phred33';
          this.minLength = 0;
          this.minMeanQ = 0;
        } catch (error) {
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid FASTQ'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.warnings.length) this.toast.info(`${this.currentFile.warnings.length} note(s) about this file`);
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleFastqFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.selectedReadIndex = 0;
    this.encoding = this.parsed?.encoding ?? 'phred33';
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRead(index: number): void {
    if (index < 0 || index >= this.visibleReads.length) return;
    this.selectedReadIndex = index;
    this.cdr.markForCheck();
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.files.length) return;
    const next = this.files.filter((_, i) => i !== index);
    this.files = next;
    if (!next.length) {
      this.clearAll();
      return;
    }
    this.currentIndex = Math.min(index, next.length - 1);
    this.selectedReadIndex = 0;
    this.renderCanvas();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedReadIndex = 0;
    this.errorMessage = '';
    this.query = '';
    this.minLength = 0;
    this.minMeanQ = 0;
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { action: string }): void {
    if (suggestion.action === 'sample') void this.loadSample();
    else this.openFilePicker();
  }

  setViewMode(mode: FastqViewMode): void {
    this.viewMode = mode;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
  }

  setEncoding(encoding: FastqEncoding): void {
    const file = this.currentFile;
    if (!file) return;
    this.encoding = encoding;
    const bytes = new TextEncoder().encode(file.text);
    const record = createFastqFileRecord(new File([file.text], file.name, { type: 'text/plain', lastModified: 0 }), bytes, encoding);
    record.id = file.id;
    record.size = file.size;
    record.extension = file.extension;
    this.files = this.files.map((item, i) => (i === this.currentIndex ? record : item));
    this.selectedReadIndex = 0;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleColor(): void {
    this.colorize = !this.colorize;
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    this.selectedReadIndex = 0;
    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: FastqExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(new TextEncoder().encode(file.text), file.name, 'text/plain');
      else if (format === 'summary-json') downloadTextFile(exportFastqSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'reads-csv') downloadTextFile(exportFastqReadsCsv(this.visibleReads), `${file.name}.reads.csv`, 'text/csv');
      else if (format === 'filtered-fastq') downloadTextFile(exportFilteredFastq(this.visibleReads), `${file.name}.filtered.fastq`, 'text/plain');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas) {
          this.toast.info('Open Quality profile to export a PNG snapshot');
          return;
        }
        const url = canvasToPngDataUrl(canvas);
        if (url) downloadDataUrl(url, `${file.name}.png`);
      }
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode !== 'quality') return;
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(220, parent.clientHeight);
    }
    if (!parsed) {
      this.clearCanvas();
      return;
    }
    if (parsed.perPositionMeanQ.length > 1) {
      drawLineChartToCanvas(canvas, parsed.perPositionMeanQ, { color: '#fb7185', background: '#0f172a' });
    } else {
      drawHistogramToCanvas(canvas, parsed.qualityHistogram, { color: '#fb7185', background: '#0f172a' });
    }
  }

  private clearCanvas(): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private observeCanvasResize(): void {
    const host = this.mapWrap?.nativeElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.renderCanvas());
    this.resizeObserver.observe(host);
  }

  private isFileDrag(event: DragEvent): boolean {
    return !!event.dataTransfer?.types?.includes('Files');
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }
}

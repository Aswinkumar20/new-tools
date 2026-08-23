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
  SEGY_ACCEPT_ATTR,
  SEGY_FORMATS_HINT,
  SEGY_FORMATS_LABEL,
  SEGY_RELATED_TOOLS,
  SEGY_SUPPORTED_EXTENSIONS
} from '../../constants/seg-y-viewer.constants';
import type {
  SegyColormap,
  SegyExportFormat,
  SegyLoadedFile,
  SegyTraceHeader,
  SegyViewMode
} from '../../types/seg-y-viewer.types';
import { canvasToPngDataUrl } from '../../utils/science-image-render.utils';
import {
  buildSegyMetadataRows,
  buildTraceMetadata,
  canExportSegy,
  createSampleSegyFile,
  createSegyFileRecord,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportSegyAmplitudesCsv,
  exportSegySummaryJson,
  exportSegyTracesCsv,
  filterSegyTraces,
  filterValidSegyFiles,
  formatSegyFileSize,
  readSegyFileBytes,
  renderSegySection,
  renderSegyWiggle,
  resolveSegySuggestion,
  segyHistogram
} from '../../utils/seg-y-viewer.utils';

@Component({
  selector: 'lib-seg-y-viewer',
  standalone: true,
  templateUrl: './seg-y-viewer.html',
  styleUrls: ['./seg-y-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SegYViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = SEGY_ACCEPT_ATTR;
  readonly relatedTools = SEGY_RELATED_TOOLS;
  readonly supportedExtensions = SEGY_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = SEGY_FORMATS_LABEL;
  readonly formatsHint = SEGY_FORMATS_HINT;
  readonly colormaps: SegyColormap[] = ['seismic', 'grayscale', 'viridis'];
  readonly viewModes: Array<{ id: SegyViewMode; label: string }> = [
    { id: 'section', label: 'Section' },
    { id: 'wiggle', label: 'Wiggle' },
    { id: 'traces', label: 'Traces' },
    { id: 'histogram', label: 'Histogram' }
  ];

  files: SegyLoadedFile[] = [];
  currentIndex = -1;
  selectedTraceIndex = 0;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  viewMode: SegyViewMode = 'section';
  query = '';
  gain = 1;
  agcWindow = 0;
  invert = false;
  colormap: SegyColormap = 'seismic';
  traceMin = 0;
  traceMax = 0;
  sampleMin = 0;
  sampleMax = 0;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): SegyLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportSegy(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildSegyMetadataRows(this.parsed) : [];
  }

  get visibleTraces(): SegyTraceHeader[] {
    return this.parsed ? filterSegyTraces(this.parsed.traces, this.query) : [];
  }

  get selectedTrace(): SegyTraceHeader | null {
    return this.parsed?.traces[this.selectedTraceIndex] ?? this.visibleTraces[0] ?? null;
  }

  get traceMetadataRows() {
    return this.selectedTrace ? buildTraceMetadata(this.selectedTrace) : [];
  }

  get histogramBars() {
    return this.parsed ? segyHistogram(this.parsed) : [];
  }

  get textCards() {
    return this.parsed?.cards ?? [];
  }

  get primarySuggestion() {
    const s = resolveSegySuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
    if (!this.parsed) return;
    if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectTrace(Math.min(this.parsed.previewTraces - 1, this.selectedTraceIndex + 1));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectTrace(Math.max(0, this.selectedTraceIndex - 1));
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.setGain(this.gain * 1.25);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.setGain(this.gain / 1.25);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitWindow();
    } else if (event.key.toLowerCase() === 'i') {
      event.preventDefault();
      this.invert = !this.invert;
      this.renderCanvas();
      this.cdr.markForCheck();
    }
  }

  trackByFileId(_i: number, file: SegyLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByTrace(_i: number, trace: SegyTraceHeader): number {
    return trace.index;
  }

  formatSize(bytes: number): string {
    return formatSegyFileSize(bytes);
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
    const { accepted, rejected } = filterValidSegyFiles(files);
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
          const bytes = await readSegyFileBytes(file);
          const record = createSegyFileRecord(file, bytes);
          const existing = this.files.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.files[existing] = record;
            this.currentIndex = existing;
          } else {
            this.files = [...this.files, record];
            this.currentIndex = this.files.length - 1;
          }
          this.resetViewForCurrent();
        } catch (error) {
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid SEG-Y'}`;
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
    await this.handleFiles([createSampleSegyFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectTrace(index: number): void {
    if (!this.parsed || index < 0 || index >= this.parsed.previewTraces) return;
    this.selectedTraceIndex = index;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setGain(value: number): void {
    this.gain = Math.max(0.05, Math.min(20, value));
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setColormap(map: SegyColormap): void {
    this.colormap = map;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleInvert(): void {
    this.invert = !this.invert;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onWindowChange(): void {
    if (!this.parsed) return;
    this.traceMin = Math.max(0, Math.min(this.parsed.previewTraces - 1, this.traceMin));
    this.traceMax = Math.max(this.traceMin, Math.min(this.parsed.previewTraces - 1, this.traceMax));
    this.sampleMin = Math.max(0, Math.min(this.parsed.previewSamples - 1, this.sampleMin));
    this.sampleMax = Math.max(this.sampleMin, Math.min(this.parsed.previewSamples - 1, this.sampleMax));
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  fitWindow(): void {
    if (!this.parsed) return;
    this.traceMin = 0;
    this.traceMax = Math.max(0, this.parsed.previewTraces - 1);
    this.sampleMin = 0;
    this.sampleMax = Math.max(0, this.parsed.previewSamples - 1);
    this.gain = 1;
    this.agcWindow = 0;
    this.onWindowChange();
  }

  onFilterChange(): void {
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
    this.resetViewForCurrent();
    this.renderCanvas();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedTraceIndex = 0;
    this.errorMessage = '';
    this.query = '';
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

  setViewMode(mode: SegyViewMode): void {
    this.viewMode = mode;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
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

  exportAs(format: SegyExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportSegySummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'traces-csv') downloadTextFile(exportSegyTracesCsv(this.visibleTraces.length ? this.visibleTraces : file.parsed.traces), `${file.name}.traces.csv`, 'text/csv');
      else if (format === 'amplitudes-csv') {
        const start = Math.floor(this.traceMin);
        const end = Math.floor(this.traceMax);
        const indices = [];
        for (let i = start; i <= end; i++) indices.push(i);
        downloadTextFile(exportSegyAmplitudesCsv(file.parsed, indices.slice(0, 40), 2), `${file.name}.amplitudes.csv`, 'text/csv');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas) {
          this.toast.info('Open Section or Wiggle to export a PNG snapshot');
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

  private resetViewForCurrent(): void {
    const parsed = this.parsed;
    this.selectedTraceIndex = 0;
    this.query = '';
    this.gain = 1;
    this.agcWindow = 0;
    this.invert = false;
    this.colormap = 'seismic';
    if (!parsed) {
      this.traceMin = 0;
      this.traceMax = 0;
      this.sampleMin = 0;
      this.sampleMax = 0;
      return;
    }
    this.traceMin = 0;
    this.traceMax = Math.max(0, parsed.previewTraces - 1);
    this.sampleMin = 0;
    this.sampleMax = Math.max(0, parsed.previewSamples - 1);
  }

  private renderCanvas(): void {
    if (!this.isBrowser || (this.viewMode !== 'section' && this.viewMode !== 'wiggle')) return;
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(280, parent.clientHeight || 420);
    }
    if (!parsed?.previewTraces) {
      this.clearCanvas();
      return;
    }
    if (this.viewMode === 'wiggle') {
      renderSegyWiggle(canvas, parsed, {
        centerTrace: this.selectedTraceIndex,
        sampleMin: this.sampleMin,
        sampleMax: this.sampleMax,
        gain: this.gain,
        invert: this.invert
      });
      return;
    }
    renderSegySection(canvas, parsed, {
      traceMin: this.traceMin,
      traceMax: this.traceMax,
      sampleMin: this.sampleMin,
      sampleMax: this.sampleMax,
      gain: this.gain,
      agcWindow: this.agcWindow,
      invert: this.invert,
      colormap: this.colormap,
      selectedTrace: this.selectedTraceIndex
    });
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

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
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import {
  ROOT_ACCEPT_ATTR,
  ROOT_FORMATS_HINT,
  ROOT_FORMATS_LABEL,
  ROOT_RELATED_TOOLS,
  ROOT_SUPPORTED_EXTENSIONS
} from '../../constants/root-file-viewer.constants';
import type {
  RootExportFormat,
  RootHistogramBar,
  RootLoadedFile,
  RootObject
} from '../../types/root-file-viewer.types';
import {
  canvasToPngDataUrl,
  drawHistogramToCanvas
} from '../../utils/science-image-render.utils';
import {
  buildRootFileMetadataRows,
  buildRootHistogramBars,
  buildRootMetadataRows,
  canExportRoot,
  createRootFileRecord,
  createSampleRootFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportRootHistogramCsv,
  exportRootObjectsJson,
  exportRootSummaryJson,
  filterValidRootFiles,
  formatRootFileSize,
  getRootObject,
  readRootFileBytes,
  resolveRootSuggestion
} from '../../utils/root-file-viewer.utils';

@Component({
  selector: 'lib-root-file-viewer',
  standalone: true,
  templateUrl: './root-file-viewer.html',
  styleUrls: ['./root-file-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RootFileViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;

  readonly acceptAttr = ROOT_ACCEPT_ATTR;
  readonly relatedTools = ROOT_RELATED_TOOLS;
  readonly supportedExtensions = ROOT_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = ROOT_FORMATS_LABEL;
  readonly formatsHint = ROOT_FORMATS_HINT;

  files: RootLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  selectedObjectIndex = 0;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): RootLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get object(): RootObject | null {
    const file = this.currentFile;
    if (!file?.parsed) return null;
    return getRootObject(file, this.selectedObjectIndex);
  }

  get canExport(): boolean {
    return canExportRoot(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get objectLabel(): string {
    const obj = this.object;
    return obj ? `${obj.className} · ${obj.name}` : '';
  }

  get histogramBars(): RootHistogramBar[] {
    const hist = this.object?.histogram;
    return hist ? buildRootHistogramBars(hist) : [];
  }

  get metadataRows() {
    return this.object ? buildRootMetadataRows(this.object) : [];
  }

  get fileMetadataRows() {
    return this.parsed ? buildRootFileMetadataRows(this.parsed) : [];
  }

  get primarySuggestion() {
    const s = resolveRootSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
    if (!this.currentFile || this.isTypingTarget(event.target)) return;
    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.renderCanvas();
    }
  }

  trackByFileId(_index: number, file: RootLoadedFile): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  trackByObject(_index: number, obj: RootObject): number {
    return obj.index;
  }

  formatSize(bytes: number): string {
    return formatRootFileSize(bytes);
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
    const { accepted, rejected } = filterValidRootFiles(files);
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
          const bytes = await readRootFileBytes(file);
          const record = createRootFileRecord(file, bytes);
          const existing = this.files.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.files[existing] = record;
            this.currentIndex = existing;
          } else {
            this.files = [...this.files, record];
            this.currentIndex = this.files.length - 1;
          }
          this.syncFromCurrent();
        } catch (error) {
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid ROOT file'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.warnings.length) {
          this.toast.info(`${this.currentFile.warnings.length} note(s) about this file`);
        }
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleRootFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.syncFromCurrent();
    this.renderCanvas();
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
    this.syncFromCurrent();
    this.renderCanvas();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.errorMessage = '';
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

  selectObject(index: number): void {
    this.selectedObjectIndex = index;
    this.renderCanvas();
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

  exportAs(format: RootExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    const obj = this.object;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportRootSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'objects-json') downloadTextFile(exportRootObjectsJson(file), `${file.name}.objects.json`, 'application/json');
      else if (format === 'histogram-csv' && obj?.histogram) downloadTextFile(exportRootHistogramCsv(obj.histogram), `${obj.name}.csv`, 'text/csv');
      else if (format === 'png') {
        const url = canvasToPngDataUrl(this.canvasHost.nativeElement);
        if (url) downloadDataUrl(url, `${file.name}.png`);
      }
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  private syncFromCurrent(): void {
    const parsed = this.parsed;
    if (!parsed) return;
    this.selectedObjectIndex = parsed.defaultObjectIndex;
  }

  private renderCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasHost?.nativeElement;
    const hist = this.object?.histogram;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
    if (!hist) {
      this.clearCanvas();
      return;
    }
    const inner = hist.values.subarray(1, Math.max(1, hist.values.length - 1));
    drawHistogramToCanvas(canvas, inner, { color: '#a855f7' });
  }

  private clearCanvas(): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private observeCanvasResize(): void {
    const canvas = this.canvasHost?.nativeElement;
    const parent = canvas?.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.renderCanvas());
    this.resizeObserver.observe(parent);
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

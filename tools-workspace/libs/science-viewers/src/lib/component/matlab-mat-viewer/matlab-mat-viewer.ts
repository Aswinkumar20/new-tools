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
import {
  AssetService,
  Navigation,
  ToastService
} from '@tools-workspace/features-home';
import {
  MAT_ACCEPT_ATTR,
  MAT_FORMATS_HINT,
  MAT_FORMATS_LABEL,
  MAT_RELATED_TOOLS,
  MAT_SUPPORTED_EXTENSIONS
} from '../../constants/matlab-mat-viewer.constants';
import type {
  MatColormap,
  MatExportFormat,
  MatHistogramBar,
  MatLoadedFile,
  MatPlane,
  MatVariablePreview
} from '../../types/matlab-mat-viewer.types';
import {
  canvasToPngDataUrl,
  computeZoomFit,
  drawImageDataToCanvas,
  drawLineChartToCanvas,
  pixelsToImageData
} from '../../utils/science-image-render.utils';
import {
  buildMatHistogramBars,
  buildMatMetadataRows,
  canExportMat,
  createMatFileRecord,
  createSampleMatFile,
  defaultWindowForPreview,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportMatSummaryJson,
  exportMatVariableCsv,
  exportMatVariablesJson,
  extractMatSlice,
  filterValidMatFiles,
  formatMatFileSize,
  getVariablePreview,
  maxMatSliceIndex,
  readMatFileBytes,
  resolveMatSuggestion
} from '../../utils/matlab-mat-viewer.utils';

@Component({
  selector: 'lib-matlab-mat-viewer',
  standalone: true,
  templateUrl: './matlab-mat-viewer.html',
  styleUrls: ['./matlab-mat-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatlabMatViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;

  readonly acceptAttr = MAT_ACCEPT_ATTR;
  readonly relatedTools = MAT_RELATED_TOOLS;
  readonly supportedExtensions = MAT_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = MAT_FORMATS_LABEL;
  readonly formatsHint = MAT_FORMATS_HINT;
  readonly planes: MatPlane[] = ['axial', 'coronal', 'sagittal'];
  readonly colormaps: MatColormap[] = ['grayscale', 'hot', 'viridis'];

  files: MatLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  selectedVariable = '';
  plane: MatPlane = 'axial';
  sliceIndex = 0;
  windowCenter = 0;
  windowWidth = 1;
  invert = false;
  colormap: MatColormap = 'viridis';
  zoom = 1;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): MatLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportMat(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get preview(): MatVariablePreview | null {
    const file = this.currentFile;
    if (!file?.parsed) return null;
    if (!this.selectedVariable) return file.parsed.preview;
    return getVariablePreview(file, this.selectedVariable);
  }

  get maxSlice(): number {
    const preview = this.preview;
    if (!preview || preview.rank < 3) return 0;
    return maxMatSliceIndex(preview.viewDims, this.plane);
  }

  get planeLabel(): string {
    const preview = this.preview;
    if (!preview) return '';
    if (preview.rank === 1) return '1D series';
    if (preview.rank === 2) return `2D grid · ${preview.shape.join('×')}`;
    return `${this.plane} · ${this.sliceIndex + 1} / ${this.maxSlice + 1}`;
  }

  get histogramBars(): MatHistogramBar[] {
    const preview = this.preview;
    if (!preview?.data.length) return [];
    return buildMatHistogramBars(preview);
  }

  get metadataRows() {
    return this.parsed ? buildMatMetadataRows(this.parsed) : [];
  }

  get primarySuggestion() {
    const suggestion = resolveMatSuggestion({
      hasFiles: this.files.length > 0,
      hasError: !!this.errorMessage
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) return null;
    return suggestion;
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.observeCanvasResize();
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
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.setSlice(this.sliceIndex - 1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.setSlice(this.sliceIndex + 1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitZoom();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-') {
      event.preventDefault();
      this.zoomOut();
    }
  }

  trackByFileId(_index: number, file: MatLoadedFile): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  trackByVariableName(_index: number, variable: { name: string }): string {
    return variable.name;
  }

  formatSize(bytes: number): string {
    return formatMatFileSize(bytes);
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
    const { accepted, rejected } = filterValidMatFiles(files);
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
          const bytes = await readMatFileBytes(file);
          const record = createMatFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid MAT'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.fitZoom();
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
    await this.handleFiles([createSampleMatFile()]);
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

  selectVariable(name: string): void {
    this.selectedVariable = name;
    const preview = this.preview;
    if (preview) {
      const win = defaultWindowForPreview(preview);
      this.windowCenter = win.center;
      this.windowWidth = win.width;
      this.sliceIndex = 0;
    }
    this.fitZoom();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setPlane(plane: MatPlane): void {
    this.plane = plane;
    this.sliceIndex = 0;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setSlice(index: number): void {
    this.sliceIndex = Math.max(0, Math.min(this.maxSlice, index));
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setColormap(colormap: MatColormap): void {
    this.colormap = colormap;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleInvert(): void {
    this.invert = !this.invert;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  zoomIn(): void {
    this.zoom = Math.min(8, this.zoom * 1.15);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  zoomOut(): void {
    this.zoom = Math.max(0.1, this.zoom / 1.15);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  fitZoom(): void {
    const preview = this.preview;
    const canvas = this.canvasHost?.nativeElement;
    if (!preview || !canvas) return;
    const dims = preview.rank >= 3 ? this.getSliceDims(preview) : { width: preview.viewDims[0], height: preview.viewDims[1] };
    this.zoom = computeZoomFit(canvas.clientWidth, canvas.clientHeight, dims.width, dims.height);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  resetZoom(): void {
    this.zoom = 1;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    setTimeout(() => this.fitZoom(), 0);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: MatExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    const preview = this.preview;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/matlab');
      else if (format === 'summary-json') downloadTextFile(exportMatSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'variables-json') downloadTextFile(exportMatVariablesJson(file), `${file.name}.variables.json`, 'application/json');
      else if (format === 'variable-csv' && preview) downloadTextFile(exportMatVariableCsv(preview), `${preview.variableName}.csv`, 'text/csv');
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

  onCanvasWheel(event: WheelEvent): void {
    if (!this.preview) return;
    event.preventDefault();
    if (event.deltaY < 0) this.zoomIn();
    else this.zoomOut();
  }

  private syncFromCurrent(): void {
    const parsed = this.parsed;
    if (!parsed) return;
    this.selectedVariable = parsed.defaultVariableName;
    const preview = this.preview;
    if (preview) {
      const win = defaultWindowForPreview(preview);
      this.windowCenter = win.center;
      this.windowWidth = win.width;
      this.sliceIndex = 0;
    }
  }

  private getSliceDims(preview: MatVariablePreview): { width: number; height: number } {
    if (preview.rank === 1) return { width: preview.data.length, height: 1 };
    if (preview.rank === 2) return { width: preview.viewDims[0], height: preview.viewDims[1] };
    const slice = extractMatSlice(preview.data, preview.viewDims, this.plane, this.sliceIndex);
    return { width: slice.width, height: slice.height };
  }

  private renderCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasHost?.nativeElement;
    const preview = this.preview;
    if (!canvas || !preview) return;

    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }

    if (preview.rank === 1) {
      drawLineChartToCanvas(canvas, preview.data, { color: '#0d9488' });
      return;
    }

    let pixels: Float32Array;
    let width: number;
    let height: number;
    if (preview.rank === 2) {
      width = preview.viewDims[0];
      height = preview.viewDims[1];
      pixels = preview.data;
    } else {
      const slice = extractMatSlice(preview.data, preview.viewDims, this.plane, this.sliceIndex);
      pixels = slice.pixels;
      width = slice.width;
      height = slice.height;
    }

    const imageData = pixelsToImageData(pixels, width, height, {
      center: this.windowCenter,
      width: this.windowWidth,
      invert: this.invert,
      colormap: this.colormap
    });
    drawImageDataToCanvas(canvas, imageData, { zoom: this.zoom });
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
    this.resizeObserver = new ResizeObserver(() => {
      this.fitZoom();
    });
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

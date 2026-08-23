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
  HDF5_ACCEPT_ATTR,
  HDF5_FORMATS_HINT,
  HDF5_FORMATS_LABEL,
  HDF5_RELATED_TOOLS,
  HDF5_SUPPORTED_EXTENSIONS
} from '../../constants/hdf5-viewer.constants';
import type {
  Hdf5Colormap,
  Hdf5DatasetPreview,
  Hdf5ExportFormat,
  Hdf5HistogramBar,
  Hdf5LoadedFile,
  Hdf5Plane,
  Hdf5TreeNode,
  Hdf5ViewMode
} from '../../types/hdf5-viewer.types';
import {
  canvasToPngDataUrl,
  computeZoomFit,
  drawImageDataToCanvas,
  drawLineChartToCanvas,
  pixelsToImageData
} from '../../utils/science-image-render.utils';
import {
  buildHdf5HistogramBars,
  buildHdf5MetadataRows,
  canExportHdf5,
  createHdf5FileRecord,
  createSampleHdf5File,
  defaultWindowForPreview,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportHdf5DatasetCsv,
  exportHdf5DatasetJson,
  exportHdf5SummaryJson,
  exportHdf5TreeJson,
  extractHdf5Slice,
  filterTreeNodes,
  filterValidHdf5Files,
  flattenTree,
  formatHdf5FileSize,
  getDatasetPreview,
  maxHdf5SliceIndex,
  readHdf5FileBytes,
  resolveHdf5Suggestion
} from '../../utils/hdf5-viewer.utils';

@Component({
  selector: 'lib-hdf5-viewer',
  standalone: true,
  templateUrl: './hdf5-viewer.html',
  styleUrls: ['./hdf5-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Hdf5ViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;
  @ViewChild('treeSearchInput') treeSearchInput!: ElementRef<HTMLInputElement>;

  readonly acceptAttr = HDF5_ACCEPT_ATTR;
  readonly relatedTools = HDF5_RELATED_TOOLS;
  readonly supportedExtensions = HDF5_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = HDF5_FORMATS_LABEL;
  readonly formatsHint = HDF5_FORMATS_HINT;
  readonly planes: Hdf5Plane[] = ['axial', 'coronal', 'sagittal'];
  readonly colormaps: Hdf5Colormap[] = ['grayscale', 'hot', 'viridis'];
  readonly viewModes: ReadonlyArray<{ id: Hdf5ViewMode; label: string }> = [
    { id: 'preview', label: 'Preview' },
    { id: 'tree', label: 'Tree' },
    { id: 'attributes', label: 'Attributes' }
  ];

  files: Hdf5LoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  viewMode: Hdf5ViewMode = 'preview';
  treeQuery = '';
  selectedPath = '';
  plane: Hdf5Plane = 'axial';
  sliceIndex = 0;
  windowCenter = 0;
  windowWidth = 1;
  invert = false;
  colormap: Hdf5Colormap = 'hot';
  zoom = 1;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): Hdf5LoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportHdf5(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get preview(): Hdf5DatasetPreview | null {
    const file = this.currentFile;
    if (!file?.parsed) return null;
    if (!this.selectedPath) return file.parsed.preview;
    return getDatasetPreview(file, this.selectedPath);
  }

  get flatTree(): Hdf5TreeNode[] {
    if (!this.parsed) return [];
    return filterTreeNodes(this.parsed.tree, this.treeQuery);
  }

  get maxSlice(): number {
    const preview = this.preview;
    if (!preview || preview.rank < 3) return 0;
    return maxHdf5SliceIndex(preview.viewDims, this.plane);
  }

  get planeLabel(): string {
    const preview = this.preview;
    if (!preview) return '';
    if (preview.rank === 1) return `${preview.path} · 1D`;
    if (preview.rank === 2) return `${preview.path} · ${preview.shape.join('×')}`;
    return `${preview.path} · ${this.plane} ${this.sliceIndex + 1}/${this.maxSlice + 1}`;
  }

  get histogramBars(): Hdf5HistogramBar[] {
    const preview = this.preview;
    if (!preview?.data.length) return [];
    return buildHdf5HistogramBars(preview);
  }

  get metadataRows() {
    return this.parsed ? buildHdf5MetadataRows(this.parsed) : [];
  }

  get primarySuggestion() {
    const suggestion = resolveHdf5Suggestion({
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
    if (event.key === '/' && this.viewMode === 'tree') {
      event.preventDefault();
      this.treeSearchInput?.nativeElement?.focus();
    } else if (event.key === 'Escape') {
      this.treeQuery = '';
      this.cdr.markForCheck();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.setSlice(this.sliceIndex - 1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.setSlice(this.sliceIndex + 1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitZoom();
    }
  }

  trackByFileId(_index: number, file: Hdf5LoadedFile): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  trackByNodePath(_index: number, node: Hdf5TreeNode): string {
    return node.path;
  }

  trackByDatasetPath(_index: number, ds: { path: string }): string {
    return ds.path;
  }

  formatSize(bytes: number): string {
    return formatHdf5FileSize(bytes);
  }

  setViewMode(mode: Hdf5ViewMode): void {
    this.viewMode = mode;
    if (mode === 'preview') setTimeout(() => this.renderCanvas(), 0);
    this.cdr.markForCheck();
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
    const { accepted, rejected } = filterValidHdf5Files(files);
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
          const bytes = await readHdf5FileBytes(file);
          const record = createHdf5FileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid HDF5'}`;
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
    await this.handleFiles([createSampleHdf5File()]);
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

  selectNode(node: Hdf5TreeNode): void {
    if (node.kind === 'group') return;
    this.selectedPath = node.path;
    this.viewMode = 'preview';
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

  setPlane(plane: Hdf5Plane): void {
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

  setColormap(colormap: Hdf5Colormap): void {
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

  exportAs(format: Hdf5ExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    const preview = this.preview;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/x-hdf5');
      else if (format === 'summary-json') downloadTextFile(exportHdf5SummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'tree-json') downloadTextFile(exportHdf5TreeJson(file), `${file.name}.tree.json`, 'application/json');
      else if (format === 'dataset-json' && preview) downloadTextFile(exportHdf5DatasetJson(preview), `${preview.path}.json`, 'application/json');
      else if (format === 'dataset-csv' && preview) downloadTextFile(exportHdf5DatasetCsv(preview), `${preview.path}.csv`, 'text/csv');
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

  get allTreeCount(): number {
    return this.parsed ? flattenTree(this.parsed.tree).length : 0;
  }

  private syncFromCurrent(): void {
    const parsed = this.parsed;
    if (!parsed) return;
    this.selectedPath = parsed.defaultDatasetPath;
    const preview = this.preview;
    if (preview) {
      const win = defaultWindowForPreview(preview);
      this.windowCenter = win.center;
      this.windowWidth = win.width;
      this.sliceIndex = 0;
    }
  }

  private getSliceDims(preview: Hdf5DatasetPreview): { width: number; height: number } {
    if (preview.rank === 1) return { width: preview.data.length, height: 1 };
    if (preview.rank === 2) return { width: preview.viewDims[0], height: preview.viewDims[1] };
    const slice = extractHdf5Slice(preview.data, preview.viewDims, this.plane, this.sliceIndex);
    return { width: slice.width, height: slice.height };
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode !== 'preview') return;
    const canvas = this.canvasHost?.nativeElement;
    const preview = this.preview;
    if (!canvas || !preview) return;

    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }

    if (preview.rank === 1) {
      drawLineChartToCanvas(canvas, preview.data, { color: '#4f46e5' });
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
      const slice = extractHdf5Slice(preview.data, preview.viewDims, this.plane, this.sliceIndex);
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
    this.resizeObserver = new ResizeObserver(() => this.fitZoom());
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

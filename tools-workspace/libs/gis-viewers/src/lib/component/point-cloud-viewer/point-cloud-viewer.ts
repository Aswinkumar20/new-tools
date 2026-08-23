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
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import {
  POINT_CLOUD_ACCEPT_ATTR,
  POINT_CLOUD_DEFAULT_OPACITY,
  POINT_CLOUD_DEFAULT_POINT_SIZE,
  POINT_CLOUD_DEFAULT_PREVIEW_CAP,
  POINT_CLOUD_FORMATS_HINT,
  POINT_CLOUD_FORMATS_LABEL,
  POINT_CLOUD_RELATED_TOOLS,
  POINT_CLOUD_SUPPORTED_EXTENSIONS
} from '../../constants/point-cloud-viewer.constants';
import type {
  PointCloudCamera,
  PointCloudColorMode,
  PointCloudExportFormat,
  PointCloudLoadedFile,
  PointCloudStats
} from '../../types/point-cloud-viewer.types';
import {
  DEFAULT_POINT_CLOUD_CAMERA,
  applyOrbitDelta,
  applyPanDelta,
  applyZoomDelta,
  filterPointsByZClip,
  normalizePointCloudCamera,
  normalizePointsForView,
  renderPointCloudCanvas
} from '../../utils/point-cloud-render.utils';
import {
  canExportPointCloud,
  createPointCloudFileRecord,
  createSamplePointCloudFile,
  downloadBinaryFile,
  downloadTextFile,
  exportPointCloudSummaryJson,
  exportXyzCsv,
  filterValidPointCloudFiles,
  formatBoundsLabel,
  formatPointCloudFileSize,
  readPointCloudFileBytes,
  resolvePointCloudSuggestion
} from '../../utils/point-cloud-viewer.utils';

@Component({
  selector: 'lib-point-cloud-viewer',
  standalone: true,
  templateUrl: './point-cloud-viewer.html',
  styleUrls: ['./point-cloud-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PointCloudViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;

  readonly acceptAttr = POINT_CLOUD_ACCEPT_ATTR;
  readonly relatedTools = POINT_CLOUD_RELATED_TOOLS;
  readonly supportedExtensions = POINT_CLOUD_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = POINT_CLOUD_FORMATS_LABEL;
  readonly formatsHint = POINT_CLOUD_FORMATS_HINT;
  readonly colorModes: PointCloudColorMode[] = [
    'intensity',
    'elevation',
    'rgb',
    'classification'
  ];

  cloudFiles: PointCloudLoadedFile[] = [];
  currentFileIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  colorMode: PointCloudColorMode = 'intensity';
  pointSize = POINT_CLOUD_DEFAULT_POINT_SIZE;
  opacity = POINT_CLOUD_DEFAULT_OPACITY;
  previewCap = POINT_CLOUD_DEFAULT_PREVIEW_CAP;
  clipMinZ = 0;
  clipMaxZ = 1;
  camera: PointCloudCamera = { ...DEFAULT_POINT_CLOUD_CAMERA };

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;
  private pointerMode: 'orbit' | 'pan' | null = null;
  private lastPointer: { x: number; y: number } | null = null;
  private viewPoints: ReturnType<typeof normalizePointsForView> = [];
  private colorSource: PointCloudLoadedFile['points'] = [];

  get currentFile(): PointCloudLoadedFile | null {
    return this.currentFileIndex >= 0 ? this.cloudFiles[this.currentFileIndex] ?? null : null;
  }

  get stats(): PointCloudStats | null {
    return this.currentFile?.stats ?? null;
  }

  get canExport(): boolean {
    return canExportPointCloud(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get boundsLabel(): string {
    return formatBoundsLabel(this.stats);
  }

  get primarySuggestion() {
    const suggestion = resolvePointCloudSuggestion({
      hasFiles: this.cloudFiles.length > 0,
      hasError: !!this.errorMessage,
      softFail: !!this.currentFile?.softFail
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) {
      return null;
    }
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
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropZone = false;
    const files = event.dataTransfer?.files;
    if (files?.length) {
      await this.handleFiles(Array.from(files));
    }
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.currentFile || this.isTypingTarget(event.target)) {
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomOut();
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      this.resetView();
    } else if (event.key === 'Escape' && this.isFullscreen) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  trackByFileId(_index: number, file: PointCloudLoadedFile): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatPointCloudFileSize(bytes);
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
    const { accepted, rejected } = filterValidPointCloudFiles(files);
    for (const item of rejected) {
      this.toast.error(`${item.name}: ${item.reason}`);
    }
    if (accepted.length === 0) {
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      for (const file of accepted) {
        try {
          const bytes = await readPointCloudFileBytes(file);
          const record = createPointCloudFileRecord(file, bytes, this.previewCap);
          const existing = this.cloudFiles.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.cloudFiles[existing] = record;
            this.currentFileIndex = existing;
          } else {
            this.cloudFiles = [...this.cloudFiles, record];
            this.currentFileIndex = this.cloudFiles.length - 1;
          }
          this.syncClipFromStats(record.stats);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid point cloud';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.rebuildViewCache();
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.warnings.length) {
          this.toast.info(`${this.currentFile.warnings.length} note(s) about this file`);
        }
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load point cloud';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSamplePointCloudFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.cloudFiles.length || index === this.currentFileIndex) {
      return;
    }
    this.currentFileIndex = index;
    this.syncClipFromStats(this.cloudFiles[index].stats);
    this.rebuildViewCache();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.cloudFiles.length) return;
    const next = this.cloudFiles.filter((_, i) => i !== index);
    this.cloudFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    this.currentFileIndex = Math.min(index, next.length - 1);
    this.syncClipFromStats(next[this.currentFileIndex].stats);
    this.rebuildViewCache();
    this.renderCanvas();
  }

  clearAll(): void {
    this.cloudFiles = [];
    this.currentFileIndex = -1;
    this.errorMessage = '';
    this.viewPoints = [];
    this.colorSource = [];
    this.camera = { ...DEFAULT_POINT_CLOUD_CAMERA };
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 220);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: PointCloudExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) {
      this.toast.error('Nothing to export');
      return;
    }
    const base = current.name.replace(/\.(las|laz|ply|pcd|e57)$/i, '') || 'point-cloud';
    try {
      if (format === 'original') {
        downloadBinaryFile(current.bytes, current.name, 'application/octet-stream');
        this.toast.success('Exported original file');
      } else if (format === 'summary-json') {
        downloadTextFile(
          exportPointCloudSummaryJson(current),
          `${base}-summary.json`,
          'application/json'
        );
        this.toast.success('Exported summary JSON');
      } else if (format === 'xyz-csv' && current.points.length) {
        downloadTextFile(exportXyzCsv(current.points, 50000), `${base}-xyz.csv`, 'text/csv');
        this.toast.success('Exported XYZ CSV (capped)');
      } else {
        this.toast.error('Export not available for this file');
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  onColorModeChange(event: Event): void {
    this.colorMode = (event.target as HTMLSelectElement).value as PointCloudColorMode;
    this.renderCanvas();
  }

  onPointSizeChange(event: Event): void {
    this.pointSize = Number((event.target as HTMLInputElement).value);
    this.renderCanvas();
  }

  onOpacityChange(event: Event): void {
    this.opacity = Number((event.target as HTMLInputElement).value);
    this.renderCanvas();
  }

  onClipMinChange(event: Event): void {
    this.clipMinZ = Number((event.target as HTMLInputElement).value);
    this.rebuildViewCache();
    this.renderCanvas();
  }

  onClipMaxChange(event: Event): void {
    this.clipMaxZ = Number((event.target as HTMLInputElement).value);
    this.rebuildViewCache();
    this.renderCanvas();
  }

  zoomIn(): void {
    this.camera = applyZoomDelta(this.camera, -120);
    this.renderCanvas();
  }

  zoomOut(): void {
    this.camera = applyZoomDelta(this.camera, 120);
    this.renderCanvas();
  }

  resetView(): void {
    this.camera = normalizePointCloudCamera({ ...DEFAULT_POINT_CLOUD_CAMERA });
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 80);
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.currentFile || this.currentFile.softFail) return;
    const canvas = this.canvasHost?.nativeElement;
    canvas?.setPointerCapture?.(event.pointerId);
    this.pointerMode =
      event.button === 2 || event.shiftKey ? 'pan' : 'orbit';
    this.lastPointer = { x: event.clientX, y: event.clientY };
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.pointerMode || !this.lastPointer) return;
    const dx = event.clientX - this.lastPointer.x;
    const dy = event.clientY - this.lastPointer.y;
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.camera =
      this.pointerMode === 'pan'
        ? applyPanDelta(this.camera, dx, dy)
        : applyOrbitDelta(this.camera, dx, dy);
    this.renderCanvas();
  }

  onPointerUp(event: PointerEvent): void {
    const canvas = this.canvasHost?.nativeElement;
    canvas?.releasePointerCapture?.(event.pointerId);
    this.pointerMode = null;
    this.lastPointer = null;
  }

  onWheel(event: WheelEvent): void {
    if (!this.currentFile || this.currentFile.softFail) return;
    event.preventDefault();
    this.camera = applyZoomDelta(this.camera, event.deltaY);
    this.renderCanvas();
  }

  onContextMenu(event: Event): void {
    event.preventDefault();
  }

  private syncClipFromStats(stats: PointCloudStats | null): void {
    if (!stats) return;
    this.clipMinZ = stats.zMin;
    this.clipMaxZ = stats.zMax;
  }

  private rebuildViewCache(): void {
    const current = this.currentFile;
    if (!current?.stats || current.points.length === 0) {
      this.viewPoints = [];
      this.colorSource = [];
      return;
    }
    const clipped = filterPointsByZClip(current.points, this.clipMinZ, this.clipMaxZ);
    this.colorSource = clipped;
    this.viewPoints = normalizePointsForView(clipped, current.stats);
  }

  private renderCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasHost?.nativeElement;
    const current = this.currentFile;
    if (!canvas) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect?.width ?? 800));
    const height = Math.max(240, Math.floor(rect?.height ?? 560));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!current?.stats || current.softFail || this.viewPoints.length === 0) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(
        current?.softFail
          ? 'Soft-fail format — convert to LAS / PLY / PCD'
          : 'Load a point cloud to orbit',
        24,
        40
      );
      this.cdr.markForCheck();
      return;
    }

    const dataUrl = renderPointCloudCanvas(
      this.viewPoints,
      current.stats,
      this.camera,
      this.colorMode,
      {
        width,
        height,
        pointSize: this.pointSize,
        opacity: this.opacity,
        colorSource: this.colorSource
      }
    );
    if (!dataUrl) {
      this.cdr.markForCheck();
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0);
      this.cdr.markForCheck();
    };
    img.src = dataUrl;
  }

  private clearCanvas(): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || typeof canvas.getContext !== 'function') return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width || 1, canvas.height || 1);
  }

  private observeCanvasResize(): void {
    const host = this.canvasHost?.nativeElement?.parentElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.renderCanvas());
    this.resizeObserver.observe(host);
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  private isFileDrag(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes('Files');
  }
}

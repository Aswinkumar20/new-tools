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
  WSI_ACCEPT_ATTR,
  WSI_FORMATS_HINT,
  WSI_FORMATS_LABEL,
  WSI_RELATED_TOOLS,
  WSI_SUPPORTED_EXTENSIONS
} from '../../constants/whole-slide-image-viewer.constants';
import type {
  WholeSlideExportFormat,
  WholeSlideLoadedImage,
  WsiPyramidLevel,
  WsiRegion
} from '../../types/whole-slide-image-viewer.types';
import { canvasToPngDataUrl } from '../../utils/medical-image-render.utils';
import {
  activePyramidLabel,
  applyWholeSlideDimensions,
  buildPyramidLevels,
  buildSlideSourceFromImage,
  canExportWholeSlide,
  computeVisibleImageRect,
  computeWholeSlideZoomFit,
  createRegionId,
  createSampleWholeSlideFile,
  createWholeSlideRecord,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  drawSlideToCanvas,
  exportRegionsJson,
  exportWholeSlideSummaryJson,
  filterValidWholeSlideFiles,
  formatWholeSlideFileSize,
  imageToScreen,
  loadImageFromBytes,
  mimeForSlideExtension,
  nextRegionColor,
  pickPyramidLevel,
  readWholeSlideFileBytes,
  resolveWholeSlideSuggestion,
  screenToImage
} from '../../utils/whole-slide-image-viewer.utils';

type WsiTool = 'pan' | 'region';

import {
  applyMedicalFullscreenToggle,
  isDocumentFullscreen,
  listenFullscreenChange
} from '../../utils/medical-fullscreen.utils';

@Component({
  selector: 'lib-whole-slide-image-viewer',
  standalone: true,
  templateUrl: './whole-slide-image-viewer.html',
  styleUrls: ['./whole-slide-image-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WholeSlideImageViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private unlistenFullscreen: (() => void) | null = null;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;
  @ViewChild('minimapHost') minimapHost!: ElementRef<HTMLCanvasElement>;

  readonly acceptAttr = WSI_ACCEPT_ATTR;
  readonly relatedTools = WSI_RELATED_TOOLS;
  readonly supportedExtensions = WSI_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = WSI_FORMATS_LABEL;
  readonly formatsHint = WSI_FORMATS_HINT;

  slideFiles: WholeSlideLoadedImage[] = [];
  currentFileIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  zoom = 1;
  activeTool: WsiTool = 'pan';
  regions: WsiRegion[] = [];

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;
  private panX = 0;
  private panY = 0;
  private fitZoomLevel = 1;
  panning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panOriginX = 0;
  private panOriginY = 0;
  private panDidMove = false;

  private slideImage: HTMLImageElement | null = null;
  private imageCache = new Map<string, HTMLImageElement>();
  private pyramidLevels: WsiPyramidLevel[] = [];

  private regionDrawing = false;
  private regionStart: { x: number; y: number } | null = null;
  private regionPreview: { x: number; y: number; width: number; height: number } | null = null;

  get currentFile(): WholeSlideLoadedImage | null {
    return this.currentFileIndex >= 0 ? this.slideFiles[this.currentFileIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportWholeSlide(this.currentFile);
  }

  get canPan(): boolean {
    return this.activeTool === 'pan' && this.zoom > this.fitZoomLevel * 1.001;
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get pyramidLabel(): string {
    return activePyramidLabel(this.pyramidLevels, this.zoom);
  }

  get pyramidLevelCount(): number {
    return this.pyramidLevels.length;
  }

  get pyramidLevelIndices(): number[] {
    return this.pyramidLevels.map((_, index) => index);
  }

  get activePyramidLevelIndex(): number {
    return pickPyramidLevel(this.pyramidLevels, this.zoom).level;
  }

  get dimensionLabel(): string {
    const current = this.currentFile;
    if (!current || current.fullWidth <= 0) return '';
    return `${current.fullWidth}×${current.fullHeight}`;
  }

  get primarySuggestion() {
    const suggestion = resolveWholeSlideSuggestion({
      hasSlides: this.slideFiles.length > 0,
      hasError: !!this.errorMessage
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) {
      return null;
    }
    return suggestion;
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.observeCanvasResize();
    this.unlistenFullscreen = listenFullscreenChange(() => {
      if (!isDocumentFullscreen() && this.isFullscreen) {
        this.isFullscreen = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.imageCache.clear();
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
    if (files?.length) {
      await this.handleFiles(Array.from(files));
    }
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.currentFile || this.isTypingTarget(event.target)) return;

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomOut();
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitZoom();
    } else if (event.key === 'Escape' && this.isFullscreen) {
      event.preventDefault();
      this.toggleFullscreen();
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      this.setTool('region');
    } else if (event.key.toLowerCase() === 'v') {
      event.preventDefault();
      this.setTool('pan');
    }
  }

  trackByFileId(_index: number, file: WholeSlideLoadedImage): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  trackByRegionId(_index: number, region: WsiRegion): string {
    return region.id;
  }

  formatSize(bytes: number): string {
    return formatWholeSlideFileSize(bytes);
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
    const { accepted, rejected } = filterValidWholeSlideFiles(files);
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
      const loaded: WholeSlideLoadedImage[] = [];
      for (const file of accepted) {
        try {
          const bytes = await readWholeSlideFileBytes(file);
          const record = await this.loadSlideRecord(file, bytes);
          loaded.push(record);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid whole slide image';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }

      if (loaded.length) {
        const byId = new Map<string, WholeSlideLoadedImage>();
        for (const item of [...this.slideFiles, ...loaded]) {
          byId.set(item.id, item);
        }
        this.slideFiles = Array.from(byId.values());
        this.currentFileIndex = Math.min(
          Math.max(0, this.slideFiles.length - loaded.length),
          this.slideFiles.length - 1
        );
        await this.syncCurrentSlide();
        this.fitZoom();
        this.renderCanvas();
        const current = this.currentFile;
        if (current) {
          this.toast.success(`Loaded ${current.name}`);
          if (current.warnings.length) {
            this.toast.info(`${current.warnings.length} note(s) about this slide`);
          }
        }
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load whole slide image';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleWholeSlideFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.slideFiles.length || index === this.currentFileIndex) {
      return;
    }
    this.currentFileIndex = index;
    void this.syncCurrentSlide().then(() => {
      this.regions = [];
      this.fitZoom();
      this.renderCanvas();
      this.cdr.markForCheck();
    });
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.slideFiles.length) return;
    const removed = this.slideFiles[index];
    if (removed) {
      this.imageCache.delete(removed.id);
    }
    const next = this.slideFiles.filter((_, i) => i !== index);
    this.slideFiles = next;
    if (next.length === 0) {
      this.clearAll();
      return;
    }
    if (this.currentFileIndex >= next.length) {
      this.currentFileIndex = next.length - 1;
    } else if (index < this.currentFileIndex) {
      this.currentFileIndex -= 1;
    }
    void this.syncCurrentSlide().then(() => {
      this.renderCanvas();
      this.cdr.markForCheck();
    });
  }

  clearAll(): void {
    this.slideFiles = [];
    this.currentFileIndex = -1;
    this.errorMessage = '';
    this.regions = [];
    this.slideImage = null;
    this.pyramidLevels = [];
    this.imageCache.clear();
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { id: string; path: string }): void {
    if (suggestion.id === 'try-sample') {
      void this.loadSample();
    } else if (suggestion.id === 'upload') {
      this.openFilePicker();
    }
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

  exportAs(format: WholeSlideExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentFile;
    if (!current) {
      this.toast.error('Nothing to export');
      return;
    }
    const base = current.name.replace(/\.[^.]+$/, '') || 'wsi-slide';
    try {
      if (format === 'original') {
        downloadBinaryFile(current.bytes, current.name, mimeForSlideExtension(current.extension));
        this.toast.success('Exported original file');
      } else if (format === 'regions-json') {
        downloadTextFile(
          exportRegionsJson(this.regions, current.name, {
            width: current.fullWidth,
            height: current.fullHeight
          }),
          `${base}-regions.json`,
          'application/json'
        );
        this.toast.success('Exported regions JSON');
      } else if (format === 'summary-json') {
        downloadTextFile(
          exportWholeSlideSummaryJson(current, this.regions.length),
          `${base}-summary.json`,
          'application/json'
        );
        this.toast.success('Exported summary JSON');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        const url = canvas ? canvasToPngDataUrl(canvas) : null;
        if (!url) {
          this.toast.error('PNG snapshot unavailable');
        } else {
          downloadDataUrl(url, `${base}-snapshot.png`);
          this.toast.success('Exported PNG snapshot');
        }
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  setTool(tool: WsiTool): void {
    this.activeTool = tool;
    this.regionDrawing = false;
    this.regionPreview = null;
    this.cdr.markForCheck();
  }

  zoomIn(): void {
    this.zoom = Math.min(32, this.zoom * 1.15);
    this.renderCanvas();
  }

  zoomOut(): void {
    this.zoom = Math.max(0.02, this.zoom / 1.15);
    this.renderCanvas();
  }

  fitZoom(): void {
    const canvas = this.canvasHost?.nativeElement;
    const current = this.currentFile;
    if (!canvas || !current || current.fullWidth <= 0) {
      this.zoom = 1;
      this.fitZoomLevel = 1;
      return;
    }
    const rect = canvas.parentElement?.getBoundingClientRect();
    const vw = Math.max(320, Math.floor(rect?.width ?? 800));
    const vh = Math.max(240, Math.floor(rect?.height ?? 560));
    this.zoom = computeWholeSlideZoomFit(vw, vh, current.fullWidth, current.fullHeight);
    this.fitZoomLevel = this.zoom;
    this.panX = 0;
    this.panY = 0;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  resetZoom(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.renderCanvas();
  }

  stepPyramidLevel(delta: number): void {
    if (!this.pyramidLevels.length) return;
    const current = pickPyramidLevel(this.pyramidLevels, this.zoom).level;
    const next = Math.max(0, Math.min(this.pyramidLevels.length - 1, current + delta));
    const level = this.pyramidLevels[next];
    if (!level) return;
    this.zoom = Math.max(0.05, 1 / level.downsample);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  goToPyramidLevel(levelIndex: number): void {
    const level = this.pyramidLevels[levelIndex];
    if (!level) return;
    this.zoom = Math.max(0.05, 1 / level.downsample);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.isBrowser) {
      this.isFullscreen = !this.isFullscreen;
      this.cdr.markForCheck();
      return;
    }
    const result = await applyMedicalFullscreenToggle(this.hostEl.nativeElement, this.isFullscreen);
    this.isFullscreen = result.active;
    this.cdr.markForCheck();
    setTimeout(() => this.fitZoom(), 80);
  }

  removeRegion(id: string, event: Event): void {
    event.stopPropagation();
    this.regions = this.regions.filter((r) => r.id !== id);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  clearRegions(): void {
    this.regions = [];
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onCanvasMouseDown(event: MouseEvent): void {
    const current = this.currentFile;
    if (!current || !this.slideImage) return;

    if (this.activeTool === 'region') {
      event.preventDefault();
      const pt = this.pointerToImage(event.clientX, event.clientY);
      if (!pt) return;
      this.regionDrawing = true;
      this.regionStart = pt;
      this.regionPreview = { x: pt.x, y: pt.y, width: 0, height: 0 };
      return;
    }

    if (!this.canPan) return;
    event.preventDefault();
    this.panning = true;
    this.panDidMove = false;
    this.panStartX = event.clientX;
    this.panStartY = event.clientY;
    this.panOriginX = this.panX;
    this.panOriginY = this.panY;
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (this.regionDrawing && this.regionStart) {
      const pt = this.pointerToImage(event.clientX, event.clientY);
      if (!pt) return;
      const x0 = Math.min(this.regionStart.x, pt.x);
      const y0 = Math.min(this.regionStart.y, pt.y);
      const x1 = Math.max(this.regionStart.x, pt.x);
      const y1 = Math.max(this.regionStart.y, pt.y);
      this.regionPreview = {
        x: x0,
        y: y0,
        width: x1 - x0,
        height: y1 - y0
      };
      this.renderCanvas();
      return;
    }

    if (!this.panning) return;
    const dx = event.clientX - this.panStartX;
    const dy = event.clientY - this.panStartY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      this.panDidMove = true;
    }
    this.panX = this.panOriginX + dx;
    this.panY = this.panOriginY + dy;
    this.renderCanvas();
  }

  onCanvasMouseUp(event: MouseEvent): void {
    if (this.regionDrawing && this.regionStart) {
      this.regionDrawing = false;
      const current = this.currentFile;
      const preview = this.regionPreview;
      this.regionStart = null;
      this.regionPreview = null;
      if (current && preview && preview.width >= 4 && preview.height >= 4) {
        const region: WsiRegion = {
          id: createRegionId(),
          name: `ROI ${this.regions.length + 1}`,
          x: Math.round(preview.x),
          y: Math.round(preview.y),
          width: Math.round(preview.width),
          height: Math.round(preview.height),
          color: nextRegionColor(this.regions.length)
        };
        this.regions = [...this.regions, region];
        this.toast.success(`Added ${region.name}`);
      }
      this.renderCanvas();
      this.cdr.markForCheck();
      return;
    }

    if (this.panDidMove) {
      this.panDidMove = false;
    }
    this.panning = false;
    void event;
  }

  onCanvasMouseLeave(): void {
    this.panning = false;
    if (this.regionDrawing) {
      this.regionDrawing = false;
      this.regionStart = null;
      this.regionPreview = null;
      this.renderCanvas();
    }
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!this.currentFile) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.zoom = Math.min(32, Math.max(0.02, this.zoom * factor));
    this.renderCanvas();
  }

  private async loadSlideRecord(file: File, bytes: Uint8Array): Promise<WholeSlideLoadedImage> {
    let record = createWholeSlideRecord(file, bytes);
    const mime = mimeForSlideExtension(record.extension);
    const img = await loadImageFromBytes(bytes, mime);
    const source = await buildSlideSourceFromImage(img, [...record.warnings]);
    record = applyWholeSlideDimensions(record, source.fullWidth, source.fullHeight);
    record = { ...record, warnings: source.warnings };
    this.imageCache.set(record.id, img);
    return record;
  }

  private async syncCurrentSlide(): Promise<void> {
    const current = this.currentFile;
    if (!current) {
      this.slideImage = null;
      this.pyramidLevels = [];
      return;
    }

    let img = this.imageCache.get(current.id);
    if (!img) {
      img = await loadImageFromBytes(current.bytes, mimeForSlideExtension(current.extension));
      this.imageCache.set(current.id, img);
    }
    this.slideImage = img;
    this.pyramidLevels = buildPyramidLevels(current.fullWidth, current.fullHeight);
  }

  private pointerToImage(clientX: number, clientY: number): { x: number; y: number } | null {
    const canvas = this.canvasHost?.nativeElement;
    const current = this.currentFile;
    if (!canvas || !current || current.fullWidth <= 0) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    return screenToImage(
      mx,
      my,
      { zoom: this.zoom, panX: this.panX, panY: this.panY },
      canvas.width,
      canvas.height,
      current.fullWidth,
      current.fullHeight
    );
  }

  private renderCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasHost?.nativeElement;
    const current = this.currentFile;
    const image = this.slideImage;
    if (!canvas) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect?.width ?? 800));
    const height = Math.max(240, Math.floor(rect?.height ?? 560));
    canvas.width = width;
    canvas.height = height;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    if (!current || !image || current.fullWidth <= 0) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('Load a whole slide image to preview', 24, 40);
      this.renderMinimap();
      this.cdr.markForCheck();
      return;
    }

    drawSlideToCanvas(canvas, image, {
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY
    });

    this.drawRegionsOverlay(ctx, canvas, current.fullWidth, current.fullHeight);
    if (this.regionPreview) {
      this.drawRegionRect(ctx, canvas, current.fullWidth, current.fullHeight, this.regionPreview, '#fbbf24', true);
    }

    this.renderMinimap();
    this.cdr.markForCheck();
  }

  private drawRegionsOverlay(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    imageWidth: number,
    imageHeight: number
  ): void {
    for (const region of this.regions) {
      this.drawRegionRect(ctx, canvas, imageWidth, imageHeight, region, region.color, false);
    }
  }

  private drawRegionRect(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    imageWidth: number,
    imageHeight: number,
    rect: { x: number; y: number; width: number; height: number },
    color: string,
    dashed: boolean
  ): void {
    const tl = imageToScreen(rect.x, rect.y, { zoom: this.zoom, panX: this.panX, panY: this.panY }, canvas.width, canvas.height, imageWidth, imageHeight);
    const br = imageToScreen(
      rect.x + rect.width,
      rect.y + rect.height,
      { zoom: this.zoom, panX: this.panX, panY: this.panY },
      canvas.width,
      canvas.height,
      imageWidth,
      imageHeight
    );
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (dashed) ctx.setLineDash([6, 4]);
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.restore();
  }

  private renderMinimap(): void {
    const minimap = this.minimapHost?.nativeElement;
    const image = this.slideImage;
    const current = this.currentFile;
    const mainCanvas = this.canvasHost?.nativeElement;
    if (!minimap || !image || !current || current.fullWidth <= 0) return;

    const size = 128;
    minimap.width = size;
    minimap.height = size;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = minimap.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    const scale = Math.min(size / current.fullWidth, size / current.fullHeight);
    const drawW = current.fullWidth * scale;
    const drawH = current.fullHeight * scale;
    const ox = (size - drawW) / 2;
    const oy = (size - drawH) / 2;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(image, ox, oy, drawW, drawH);

    if (mainCanvas) {
      const visible = computeVisibleImageRect(
        { zoom: this.zoom, panX: this.panX, panY: this.panY },
        mainCanvas.width,
        mainCanvas.height,
        current.fullWidth,
        current.fullHeight
      );
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        ox + visible.x * scale,
        oy + visible.y * scale,
        visible.width * scale,
        visible.height * scale
      );
    }

    for (const region of this.regions) {
      ctx.strokeStyle = region.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        ox + region.x * scale,
        oy + region.y * scale,
        region.width * scale,
        region.height * scale
      );
    }
  }

  private clearCanvas(): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || typeof canvas.getContext !== 'function') return;
    if (typeof process !== 'undefined' && process.env['JEST_WORKER_ID']) {
      return;
    }
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

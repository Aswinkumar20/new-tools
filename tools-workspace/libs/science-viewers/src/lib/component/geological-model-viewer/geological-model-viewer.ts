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
import { AssetService, Navigation, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import {
  GEO_MODEL_ACCEPT_ATTR,
  GEO_MODEL_FORMATS_HINT,
  GEO_MODEL_FORMATS_LABEL,
  GEO_MODEL_RELATED_TOOLS,
  GEO_MODEL_SUPPORTED_EXTENSIONS
} from '../../constants/geological-model-viewer.constants';
import type {
  GeoModelExportFormat,
  GeoModelFault,
  GeoModelLayer,
  GeoModelLoadedFile,
  GeoModelViewMode,
  GeoModelWell
} from '../../types/geological-model-viewer.types';
import { canvasToPngDataUrl } from '../../utils/science-image-render.utils';
import {
  buildGeoModelMetadataRows,
  buildLayerMetadata,
  canExportGeoModel,
  createGeoModelFileRecord,
  createSampleGeoModelFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportGeoLayersCsv,
  exportGeoModelSummaryJson,
  exportGeoSectionCsv,
  filterGeoLayers,
  filterValidGeoModelFiles,
  formatGeoModelFileSize,
  readGeoModelFileBytes,
  renderGeoModelMap,
  renderGeoModelSection,
  resolveGeoModelSuggestion
} from '../../utils/geological-model-viewer.utils';

@Component({
  selector: 'lib-geological-model-viewer',
  standalone: true,
  templateUrl: './geological-model-viewer.html',
  styleUrls: ['./geological-model-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GeologicalModelViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = GEO_MODEL_ACCEPT_ATTR;
  readonly relatedTools = GEO_MODEL_RELATED_TOOLS;
  readonly supportedExtensions = GEO_MODEL_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = GEO_MODEL_FORMATS_LABEL;
  readonly formatsHint = GEO_MODEL_FORMATS_HINT;
  readonly viewModes: Array<{ id: GeoModelViewMode; label: string }> = [
    { id: 'map', label: 'Map' },
    { id: 'section', label: 'Section' },
    { id: 'column', label: 'Column' },
    { id: 'table', label: 'Table' }
  ];

  files: GeoModelLoadedFile[] = [];
  currentIndex = -1;
  selectedLayerId = '';
  selectedWellId = '';
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  viewMode: GeoModelViewMode = 'map';
  query = '';
  exaggeration = 1;
  visibleIds = new Set<string>();

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): GeoModelLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportGeoModel(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildGeoModelMetadataRows(this.parsed) : [];
  }

  get filteredLayers(): GeoModelLayer[] {
    return filterGeoLayers(this.parsed?.layers ?? [], this.query);
  }

  get selectedLayer(): GeoModelLayer | null {
    return this.parsed?.layers.find((l) => l.id === this.selectedLayerId) ?? null;
  }

  get layerMetadataRows() {
    return this.selectedLayer ? buildLayerMetadata(this.selectedLayer) : [];
  }

  get wells(): GeoModelWell[] {
    return this.parsed?.wells ?? [];
  }

  get selectedWell(): GeoModelWell | null {
    return this.wells.find((w) => w.id === this.selectedWellId) ?? null;
  }

  get faults(): GeoModelFault[] {
    return this.parsed?.faults ?? [];
  }

  get primarySuggestion() {
    const s = resolveGeoModelSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  get canUseCanvasExport(): boolean {
    return this.viewMode === 'map' || this.viewMode === 'section';
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) this.observeCanvasResize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (!this.showExportMenu) return;
    this.showExportMenu = false;
    this.cdr.markForCheck();
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
    if (event.key === 'Escape' && this.showExportMenu) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
      return;
    }
    if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
      return;
    }
    if (!this.parsed) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.shiftLayer(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.shiftLayer(-1);
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.setExaggeration(this.exaggeration * 1.25);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.setExaggeration(this.exaggeration / 1.25);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitExaggeration();
    }
  }

  trackByFileId(_i: number, file: GeoModelLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByLayer(_i: number, layer: GeoModelLayer): string {
    return layer.id;
  }

  trackByWell(_i: number, well: GeoModelWell): string {
    return well.id;
  }

  formatSize(bytes: number): string {
    return formatGeoModelFileSize(bytes);
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
    const { accepted, rejected } = filterValidGeoModelFiles(files);
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
          const bytes = await readGeoModelFileBytes(file);
          const record = createGeoModelFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid geological model'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.errorMessage = '';
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with little or no layer data — metadata may still be available');
        } else if (this.currentFile.warnings.length) {
          this.toast.info(`${this.currentFile.warnings.length} note(s) about this file`);
        }
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleGeoModelFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
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
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedLayerId = '';
    this.selectedWellId = '';
    this.errorMessage = '';
    this.query = '';
    this.exaggeration = 1;
    this.viewMode = 'map';
    this.visibleIds = new Set();
    this.showExportMenu = false;
    this.showDropZone = false;
    this.dragDepth = 0;
    this.dismissedSuggestionId = null;
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  selectLayer(id: string): void {
    if (id === this.selectedLayerId) return;
    this.selectedLayerId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectWell(id: string): void {
    if (id === this.selectedWellId) return;
    this.selectedWellId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleLayer(id: string): void {
    if (this.visibleIds.has(id)) {
      if (this.visibleIds.size === 1) return;
      this.visibleIds.delete(id);
    } else this.visibleIds.add(id);
    this.visibleIds = new Set(this.visibleIds);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setExaggeration(value: number): void {
    const next = Math.max(0.25, Math.min(8, value));
    if (next === this.exaggeration) return;
    this.exaggeration = next;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  fitExaggeration(): void {
    this.exaggeration = 1;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedLayerId && !this.filteredLayers.some((l) => l.id === this.selectedLayerId)) {
      this.selectedLayerId = this.filteredLayers[0]?.id ?? '';
      this.renderCanvas();
    }
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

  setViewMode(mode: GeoModelViewMode): void {
    if (mode === this.viewMode) return;
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
    if (!this.canExport) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
      return;
    }
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: GeoModelExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      this.cdr.markForCheck();
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(new TextEncoder().encode(file.text), file.name, 'application/json');
      else if (format === 'summary-json') downloadTextFile(exportGeoModelSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'layers-csv') downloadTextFile(exportGeoLayersCsv(file.parsed), `${file.name}.layers.csv`, 'text/csv');
      else if (format === 'section-csv') downloadTextFile(exportGeoSectionCsv(file.parsed), `${file.name}.section.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || !this.canUseCanvasExport) {
          this.toast.info('Open Map or Section to export a PNG snapshot');
          this.cdr.markForCheck();
          return;
        }
        const url = canvasToPngDataUrl(canvas);
        if (!url) {
          this.toast.error('Could not capture PNG snapshot');
          this.cdr.markForCheck();
          return;
        }
        downloadDataUrl(url, `${file.name}.png`);
      }
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  private shiftLayer(delta: number): void {
    const layers = this.filteredLayers;
    if (!layers.length) return;
    const idx = layers.findIndex((l) => l.id === this.selectedLayerId);
    const base = idx >= 0 ? idx : 0;
    const next = layers[Math.min(layers.length - 1, Math.max(0, base + delta))];
    if (next) this.selectLayer(next.id);
  }

  private resetViewForCurrent(): void {
    const parsed = this.parsed;
    this.query = '';
    this.exaggeration = 1;
    if (!parsed?.layers.length) {
      this.visibleIds = new Set();
      this.selectedLayerId = '';
      this.selectedWellId = '';
      return;
    }
    this.visibleIds = new Set(parsed.layers.map((l) => l.id));
    this.selectedLayerId = parsed.layers[0].id;
    this.selectedWellId = parsed.wells[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || !this.canUseCanvasExport) return;
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(280, Math.min(520, parent.clientHeight || 420));
    }
    if (!parsed?.layers.length) {
      this.clearCanvas();
      return;
    }
    if (this.viewMode === 'map') {
      renderGeoModelMap(canvas, parsed, {
        selectedLayerId: this.selectedLayerId || null,
        visibleIds: this.visibleIds,
        selectedWellId: this.selectedWellId || null
      });
      return;
    }
    renderGeoModelSection(canvas, parsed, {
      visibleIds: this.visibleIds,
      selectedLayerId: this.selectedLayerId || null,
      selectedWellId: this.selectedWellId || null,
      exaggeration: this.exaggeration
    });
  }

  private clearCanvas(): void {
    if (!this.isBrowser) return;
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

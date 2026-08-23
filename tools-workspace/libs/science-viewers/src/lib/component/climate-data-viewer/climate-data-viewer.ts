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
  CLIMATE_ACCEPT_ATTR,
  CLIMATE_FORMATS_HINT,
  CLIMATE_FORMATS_LABEL,
  CLIMATE_RELATED_TOOLS,
  CLIMATE_SUPPORTED_EXTENSIONS
} from '../../constants/climate-data-viewer.constants';
import type {
  ClimateColormap,
  ClimateExportFormat,
  ClimateLoadedFile,
  ClimateStation,
  ClimateViewMode
} from '../../types/climate-data-viewer.types';
import { canvasToPngDataUrl } from '../../utils/science-image-render.utils';
import {
  buildClimateHistogram,
  buildClimateMetadataRows,
  canExportClimate,
  climateSpatialMeanSeries,
  climateStationValue,
  climateTableRows,
  createClimateFileRecord,
  createSampleClimateFile,
  defaultClimateWindow,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportClimateGridCsv,
  exportClimateSeriesCsv,
  exportClimateSummaryJson,
  filterClimateStations,
  filterValidClimateFiles,
  formatClimateFileSize,
  readClimateFileBytes,
  renderClimateMap,
  renderClimateSeries,
  resolveClimateSuggestion
} from '../../utils/climate-data-viewer.utils';

@Component({
  selector: 'lib-climate-data-viewer',
  standalone: true,
  templateUrl: './climate-data-viewer.html',
  styleUrls: ['./climate-data-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClimateDataViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = CLIMATE_ACCEPT_ATTR;
  readonly relatedTools = CLIMATE_RELATED_TOOLS;
  readonly supportedExtensions = CLIMATE_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = CLIMATE_FORMATS_LABEL;
  readonly formatsHint = CLIMATE_FORMATS_HINT;
  readonly colormaps: ClimateColormap[] = ['grayscale', 'hot', 'viridis'];
  readonly viewModes: Array<{ id: ClimateViewMode; label: string }> = [
    { id: 'map', label: 'Map' },
    { id: 'series', label: 'Time series' },
    { id: 'stations', label: 'Stations' },
    { id: 'table', label: 'Table' }
  ];

  files: ClimateLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  viewMode: ClimateViewMode = 'map';
  timeIndex = 0;
  query = '';
  selectedStationId = '';
  colormap: ClimateColormap = 'viridis';
  invert = false;
  zoom = 1;
  windowCenter = 0;
  windowWidth = 1;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): ClimateLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportClimate(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildClimateMetadataRows(this.parsed) : [];
  }

  get stations(): ClimateStation[] {
    return this.parsed?.stations ?? [];
  }

  get filteredStations(): ClimateStation[] {
    return filterClimateStations(this.stations, this.query);
  }

  get selectedStation(): ClimateStation | null {
    return this.filteredStations.find((s) => s.id === this.selectedStationId) ?? this.filteredStations[0] ?? null;
  }

  get histogramBars() {
    return this.parsed ? buildClimateHistogram(this.parsed, this.timeIndex) : [];
  }

  get tableRows() {
    return this.parsed ? climateTableRows(this.parsed, this.timeIndex) : [];
  }

  get timeLabel(): string {
    return this.parsed?.times[this.timeIndex] ?? '—';
  }

  get nt(): number {
    return this.parsed?.nt ?? 0;
  }

  get primarySuggestion() {
    const s = resolveClimateSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  stationValue(station: ClimateStation): string {
    return climateStationValue(station, this.timeIndex);
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
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.stepTime(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.stepTime(-1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.shiftStation(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.shiftStation(-1);
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomOut();
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitZoom();
    } else if (event.key.toLowerCase() === 'i') {
      event.preventDefault();
      this.toggleInvert();
    }
  }

  trackByFileId(_i: number, file: ClimateLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByStation(_i: number, station: ClimateStation): string {
    return station.id;
  }

  formatSize(bytes: number): string {
    return formatClimateFileSize(bytes);
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
    const { accepted, rejected } = filterValidClimateFiles(files);
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
          const bytes = await readClimateFileBytes(file);
          const record = createClimateFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid climate data'}`;
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
    await this.handleFiles([createSampleClimateFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectStation(id: string): void {
    this.selectedStationId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setTimeIndex(index: number): void {
    if (!this.parsed) return;
    this.timeIndex = Math.max(0, Math.min(this.parsed.nt - 1, Math.round(index)));
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  stepTime(delta: number): void {
    this.setTimeIndex(this.timeIndex + delta);
  }

  setColormap(map: ClimateColormap): void {
    this.colormap = map;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleInvert(): void {
    this.invert = !this.invert;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  zoomIn(): void {
    this.zoom = Math.min(8, this.zoom * 1.25);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  zoomOut(): void {
    this.zoom = Math.max(0.25, this.zoom / 1.25);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  fitZoom(): void {
    this.zoom = 1;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
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
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedStationId = '';
    this.timeIndex = 0;
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

  setViewMode(mode: ClimateViewMode): void {
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

  exportAs(format: ClimateExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportClimateSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'grid-csv') downloadTextFile(exportClimateGridCsv(file.parsed), `${file.name}.grid.csv`, 'text/csv');
      else if (format === 'series-csv') downloadTextFile(exportClimateSeriesCsv(file.parsed), `${file.name}.series.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table' || this.viewMode === 'stations') {
          this.toast.info('Open Map or Time series to export a PNG snapshot');
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

  private shiftStation(delta: number): void {
    const stations = this.filteredStations;
    if (!stations.length) return;
    const idx = Math.max(0, stations.findIndex((s) => s.id === this.selectedStationId));
    const next = stations[Math.min(stations.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectStation(next.id);
  }

  private resetViewForCurrent(): void {
    const parsed = this.parsed;
    this.query = '';
    this.timeIndex = 0;
    this.zoom = 1;
    this.invert = false;
    this.colormap = 'viridis';
    if (!parsed) {
      this.selectedStationId = '';
      return;
    }
    const win = defaultClimateWindow(parsed);
    this.windowCenter = win.center;
    this.windowWidth = win.width;
    this.selectedStationId = parsed.stations[0]?.id ?? '';
    if (!parsed.nx && parsed.stations.length) this.viewMode = 'series';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table' || this.viewMode === 'stations') return;
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas || !parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(280, parent.clientHeight || 420);
    }
    if (this.viewMode === 'series') {
      const series = [
        ...(parsed.nx ? [{ label: 'Spatial mean', values: climateSpatialMeanSeries(parsed), color: '#94a3b8' }] : []),
        ...this.filteredStations.map((station) => ({
          label: station.name,
          values: station.values
        }))
      ];
      renderClimateSeries(canvas, parsed.times, series, this.timeIndex);
      return;
    }
    renderClimateMap(canvas, parsed, {
      timeIndex: this.timeIndex,
      zoom: this.zoom,
      invert: this.invert,
      colormap: this.colormap,
      center: this.windowCenter,
      width: this.windowWidth,
      selectedStationId: this.selectedStationId || null
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

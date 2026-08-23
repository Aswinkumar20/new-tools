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
  SIM_ACCEPT_ATTR,
  SIM_FORMATS_HINT,
  SIM_FORMATS_LABEL,
  SIM_RELATED_TOOLS,
  SIM_SUPPORTED_EXTENSIONS
} from '../../constants/simulation-result-viewer.constants';
import type {
  SimulationColormap,
  SimulationExportFormat,
  SimulationLoadedFile,
  SimulationProbe,
  SimulationSliceAxis,
  SimulationViewMode
} from '../../types/simulation-result-viewer.types';
import { canvasToPngDataUrl } from '../../utils/science-image-render.utils';
import {
  buildSimHistogram,
  buildSimMetadataRows,
  canExportSim,
  createSampleSimFile,
  createSimFileRecord,
  defaultSimWindow,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportSimFieldCsv,
  exportSimProbesCsv,
  exportSimSummaryJson,
  filterSimulationProbes,
  filterValidSimFiles,
  formatSimFileSize,
  readSimFileBytes,
  renderSimulationField,
  renderSimulationProbes,
  renderSimulationSlice,
  resolveSimSuggestion,
  simTableRows
} from '../../utils/simulation-result-viewer.utils';

@Component({
  selector: 'lib-simulation-result-viewer',
  standalone: true,
  templateUrl: './simulation-result-viewer.html',
  styleUrls: ['./simulation-result-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimulationResultViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = SIM_ACCEPT_ATTR;
  readonly relatedTools = SIM_RELATED_TOOLS;
  readonly supportedExtensions = SIM_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = SIM_FORMATS_LABEL;
  readonly formatsHint = SIM_FORMATS_HINT;
  readonly colormaps: SimulationColormap[] = ['grayscale', 'hot', 'viridis'];
  readonly viewModes: Array<{ id: SimulationViewMode; label: string }> = [
    { id: 'field', label: 'Field' },
    { id: 'slice', label: 'Slice' },
    { id: 'probes', label: 'Probes' },
    { id: 'table', label: 'Table' }
  ];

  files: SimulationLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  viewMode: SimulationViewMode = 'field';
  timeIndex = 0;
  query = '';
  selectedProbeId = '';
  colormap: SimulationColormap = 'hot';
  invert = false;
  zoom = 1;
  windowCenter = 0;
  windowWidth = 1;
  sliceAxis: SimulationSliceAxis = 'j';
  sliceIndex = 0;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): SimulationLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportSim(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildSimMetadataRows(this.parsed) : [];
  }

  get probes(): SimulationProbe[] {
    return this.parsed?.probes ?? [];
  }

  get filteredProbes(): SimulationProbe[] {
    return filterSimulationProbes(this.probes, this.query);
  }

  get selectedProbe(): SimulationProbe | null {
    return this.filteredProbes.find((p) => p.id === this.selectedProbeId) ?? this.filteredProbes[0] ?? null;
  }

  get histogramBars() {
    return this.parsed ? buildSimHistogram(this.parsed, this.timeIndex) : [];
  }

  get tableRows() {
    return this.parsed ? simTableRows(this.parsed, this.timeIndex) : [];
  }

  get timeLabel(): string {
    if (!this.parsed) return '—';
    const t = this.parsed.times[this.timeIndex];
    return Number.isFinite(t) ? String(t) : '—';
  }

  get nt(): number {
    return this.parsed?.nt ?? 0;
  }

  get sliceMax(): number {
    if (!this.parsed) return 0;
    return this.sliceAxis === 'j' ? Math.max(0, this.parsed.ny - 1) : Math.max(0, this.parsed.nx - 1);
  }

  get primarySuggestion() {
    const s = resolveSimSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  probeValue(probe: SimulationProbe): string {
    const v = probe.values[this.timeIndex];
    return Number.isFinite(v) ? v.toFixed(2) : '—';
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
      if (this.viewMode === 'slice') this.setSliceIndex(this.sliceIndex + 1);
      else this.shiftProbe(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'slice') this.setSliceIndex(this.sliceIndex - 1);
      else this.shiftProbe(-1);
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

  trackByFileId(_i: number, file: SimulationLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByProbe(_i: number, probe: SimulationProbe): string {
    return probe.id;
  }

  formatSize(bytes: number): string {
    return formatSimFileSize(bytes);
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
    const { accepted, rejected } = filterValidSimFiles(files);
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
          const bytes = await readSimFileBytes(file);
          const record = createSimFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid simulation result'}`;
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
    await this.handleFiles([createSampleSimFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectProbe(id: string): void {
    this.selectedProbeId = id;
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

  setSliceAxis(axis: SimulationSliceAxis): void {
    this.sliceAxis = axis;
    this.sliceIndex = Math.min(this.sliceIndex, this.sliceMax);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setSliceIndex(index: number): void {
    this.sliceIndex = Math.max(0, Math.min(this.sliceMax, Math.round(index)));
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setColormap(map: SimulationColormap): void {
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
    this.selectedProbeId = '';
    this.timeIndex = 0;
    this.sliceIndex = 0;
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

  setViewMode(mode: SimulationViewMode): void {
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

  exportAs(format: SimulationExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportSimSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'field-csv') downloadTextFile(exportSimFieldCsv(file.parsed, this.timeIndex), `${file.name}.field.csv`, 'text/csv');
      else if (format === 'probes-csv') downloadTextFile(exportSimProbesCsv(file.parsed), `${file.name}.probes.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Field, Slice, or Probes to export a PNG snapshot');
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

  private shiftProbe(delta: number): void {
    const probes = this.filteredProbes;
    if (!probes.length) return;
    const idx = Math.max(0, probes.findIndex((p) => p.id === this.selectedProbeId));
    const next = probes[Math.min(probes.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectProbe(next.id);
  }

  private resetViewForCurrent(): void {
    const parsed = this.parsed;
    this.query = '';
    this.timeIndex = 0;
    this.zoom = 1;
    this.invert = false;
    this.colormap = 'hot';
    this.sliceAxis = 'j';
    if (!parsed) {
      this.selectedProbeId = '';
      this.sliceIndex = 0;
      return;
    }
    const win = defaultSimWindow(parsed);
    this.windowCenter = win.center;
    this.windowWidth = win.width;
    this.selectedProbeId = parsed.probes[0]?.id ?? '';
    this.sliceIndex = Math.floor(parsed.ny / 2);
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas || !parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(280, parent.clientHeight || 420);
    }
    if (this.viewMode === 'slice') {
      renderSimulationSlice(canvas, parsed, this.timeIndex, this.sliceAxis, this.sliceIndex);
      return;
    }
    if (this.viewMode === 'probes') {
      const series = [
        ...this.filteredProbes.map((probe) => ({ label: probe.name, values: probe.values })),
        ...parsed.metrics.map((metric) => ({ label: metric.name, values: metric.values, color: '#94a3b8' }))
      ];
      renderSimulationProbes(canvas, parsed.times, series, this.timeIndex);
      return;
    }
    renderSimulationField(canvas, parsed, {
      timeIndex: this.timeIndex,
      zoom: this.zoom,
      invert: this.invert,
      colormap: this.colormap,
      center: this.windowCenter,
      width: this.windowWidth,
      selectedProbeId: this.selectedProbeId || null
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

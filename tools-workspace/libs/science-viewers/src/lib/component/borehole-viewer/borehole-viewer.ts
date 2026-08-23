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
  BOREHOLE_ACCEPT_ATTR,
  BOREHOLE_FORMATS_HINT,
  BOREHOLE_FORMATS_LABEL,
  BOREHOLE_RELATED_TOOLS,
  BOREHOLE_SUPPORTED_EXTENSIONS
} from '../../constants/borehole-viewer.constants';
import type {
  BoreholeExportFormat,
  BoreholeLithInterval,
  BoreholeLoadedFile,
  BoreholeSurveyRow,
  BoreholeViewMode
} from '../../types/borehole-viewer.types';
import { canvasToPngDataUrl } from '../../utils/science-image-render.utils';
import {
  buildBoreholeMetadataRows,
  buildStationMetadata,
  canExportBorehole,
  createBoreholeFileRecord,
  createSampleBoreholeFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportBoreholeLithCsv,
  exportBoreholeSummaryJson,
  exportBoreholeSurveyCsv,
  filterBoreholeLith,
  filterBoreholeStations,
  filterValidBoreholeFiles,
  formatBoreholeFileSize,
  readBoreholeFileBytes,
  renderBorehole3d,
  renderBoreholePlan,
  renderBoreholeSection,
  resolveBoreholeSuggestion
} from '../../utils/borehole-viewer.utils';

@Component({
  selector: 'lib-borehole-viewer',
  standalone: true,
  templateUrl: './borehole-viewer.html',
  styleUrls: ['./borehole-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoreholeViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = BOREHOLE_ACCEPT_ATTR;
  readonly relatedTools = BOREHOLE_RELATED_TOOLS;
  readonly supportedExtensions = BOREHOLE_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = BOREHOLE_FORMATS_LABEL;
  readonly formatsHint = BOREHOLE_FORMATS_HINT;
  readonly viewModes: Array<{ id: BoreholeViewMode; label: string }> = [
    { id: 'plan', label: 'Plan' },
    { id: 'section', label: 'Section' },
    { id: '3d', label: '3D' },
    { id: 'lithology', label: 'Lithology' },
    { id: 'table', label: 'Survey' }
  ];

  files: BoreholeLoadedFile[] = [];
  currentIndex = -1;
  selectedStationIndex = 0;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  viewMode: BoreholeViewMode = 'section';
  query = '';
  exaggeration = 1;
  mdMin = 0;
  mdMax = 1;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): BoreholeLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportBorehole(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildBoreholeMetadataRows(this.parsed) : [];
  }

  get visibleStations(): BoreholeSurveyRow[] {
    return this.parsed ? filterBoreholeStations(this.parsed.survey, this.query) : [];
  }

  get selectedStation(): BoreholeSurveyRow | null {
    return this.parsed?.survey[this.selectedStationIndex] ?? this.visibleStations[0] ?? null;
  }

  get stationMetadataRows() {
    return this.selectedStation ? buildStationMetadata(this.selectedStation) : [];
  }

  get lithIntervals(): BoreholeLithInterval[] {
    return this.parsed ? filterBoreholeLith(this.parsed.lithology, this.query) : [];
  }

  get primarySuggestion() {
    const s = resolveBoreholeSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.selectStation(Math.min(this.parsed.survey.length - 1, this.selectedStationIndex + 1));
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.selectStation(Math.max(0, this.selectedStationIndex - 1));
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.setExaggeration(this.exaggeration * 1.25);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.setExaggeration(this.exaggeration / 1.25);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitDepth();
    }
  }

  trackByFileId(_i: number, file: BoreholeLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByStation(_i: number, row: BoreholeSurveyRow): number {
    return row.index;
  }

  trackByLith(_i: number, interval: BoreholeLithInterval): string {
    return interval.id;
  }

  formatSize(bytes: number): string {
    return formatBoreholeFileSize(bytes);
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
    const { accepted, rejected } = filterValidBoreholeFiles(files);
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
          const bytes = await readBoreholeFileBytes(file);
          const record = createBoreholeFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid borehole'}`;
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
    await this.handleFiles([createSampleBoreholeFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectStation(index: number): void {
    if (!this.parsed || index < 0 || index >= this.parsed.survey.length) return;
    this.selectedStationIndex = index;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setExaggeration(value: number): void {
    this.exaggeration = Math.max(0.25, Math.min(8, value));
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onDepthChange(): void {
    if (this.mdMin > this.mdMax) {
      const tmp = this.mdMin;
      this.mdMin = this.mdMax;
      this.mdMax = tmp;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  fitDepth(): void {
    if (!this.parsed?.survey.length) return;
    this.mdMin = this.parsed.survey[0].md;
    this.mdMax = this.parsed.survey[this.parsed.survey.length - 1].md;
    this.exaggeration = 1;
    this.onDepthChange();
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
    this.selectedStationIndex = 0;
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

  setViewMode(mode: BoreholeViewMode): void {
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

  exportAs(format: BoreholeExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(new TextEncoder().encode(file.text), file.name, 'application/json');
      else if (format === 'summary-json') downloadTextFile(exportBoreholeSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'survey-csv') downloadTextFile(exportBoreholeSurveyCsv(file.parsed), `${file.name}.survey.csv`, 'text/csv');
      else if (format === 'lithology-csv') downloadTextFile(exportBoreholeLithCsv(file.parsed), `${file.name}.lithology.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas) {
          this.toast.info('Open Plan, Section, or 3D to export a PNG snapshot');
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
    this.selectedStationIndex = 0;
    this.query = '';
    this.exaggeration = 1;
    if (!parsed?.survey.length) {
      this.mdMin = 0;
      this.mdMax = 1;
      return;
    }
    this.mdMin = parsed.survey[0].md;
    this.mdMax = parsed.survey[parsed.survey.length - 1].md;
  }

  private renderCanvas(): void {
    if (!this.isBrowser || (this.viewMode !== 'plan' && this.viewMode !== 'section' && this.viewMode !== '3d')) return;
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(280, parent.clientHeight || 420);
    }
    if (!parsed?.survey.length) {
      this.clearCanvas();
      return;
    }
    const common = { selectedIndex: this.selectedStationIndex, mdMin: this.mdMin, mdMax: this.mdMax };
    if (this.viewMode === 'plan') renderBoreholePlan(canvas, parsed, common);
    else if (this.viewMode === 'section') renderBoreholeSection(canvas, parsed, { ...common, exaggeration: this.exaggeration });
    else renderBorehole3d(canvas, parsed, { ...common, exaggeration: this.exaggeration });
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

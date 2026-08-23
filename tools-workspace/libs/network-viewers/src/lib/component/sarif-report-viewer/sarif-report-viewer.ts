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
  SARIF_ACCEPT_ATTR,
  SARIF_FORMATS_HINT,
  SARIF_FORMATS_LABEL,
  SARIF_RELATED_TOOLS,
  SARIF_SUPPORTED_EXTENSIONS
} from '../../constants/sarif-report-viewer.constants';
import type {
  SarifExportFormat,
  SarifLoadedFile,
  SarifLocationStat,
  SarifResult,
  SarifRuleStat,
  SarifViewMode
} from '../../types/sarif-report-viewer.types';
import {
  buildSarifLocationMetadata,
  buildSarifMetadataRows,
  buildSarifResultMetadata,
  buildSarifRuleMetadata,
  canExportSarif,
  canvasToPngDataUrl,
  createSampleSarifFile,
  createSarifFileRecord,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportSarifResultsCsv,
  exportSarifRulesCsv,
  exportSarifSummaryJson,
  filterSarifLocations,
  filterSarifResults,
  filterSarifRules,
  filterValidSarifFiles,
  formatSarifFileSize,
  readSarifFileBytes,
  renderSarifLocations,
  renderSarifRules,
  resolveSarifSuggestion,
  sarifLevelColor
} from '../../utils/sarif-report-viewer.utils';

@Component({
  selector: 'lib-sarif-report-viewer',
  standalone: true,
  templateUrl: './sarif-report-viewer.html',
  styleUrls: ['./sarif-report-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SarifReportViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = SARIF_ACCEPT_ATTR;
  readonly relatedTools = SARIF_RELATED_TOOLS;
  readonly supportedExtensions = SARIF_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = SARIF_FORMATS_LABEL;
  readonly formatsHint = SARIF_FORMATS_HINT;
  readonly viewModes: Array<{ id: SarifViewMode; label: string }> = [
    { id: 'results', label: 'Results' },
    { id: 'rules', label: 'Rules' },
    { id: 'locations', label: 'Locations' },
    { id: 'table', label: 'Table' }
  ];

  files: SarifLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: SarifViewMode = 'results';
  query = '';
  selectedId = '';
  selectedRuleId = '';
  selectedFile = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): SarifLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportSarif(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildSarifMetadataRows(this.parsed) : [];
  }

  get filteredResults(): SarifResult[] {
    return this.parsed ? filterSarifResults(this.parsed.results, this.query) : [];
  }

  get filteredRules(): SarifRuleStat[] {
    return this.parsed ? filterSarifRules(this.parsed.rules, this.query) : [];
  }

  get filteredLocations(): SarifLocationStat[] {
    return this.parsed ? filterSarifLocations(this.parsed.locations, this.query) : [];
  }

  get selectedResult(): SarifResult | null {
    return this.filteredResults.find((r) => r.id === this.selectedId) ?? this.filteredResults[0] ?? null;
  }

  get selectedRule(): SarifRuleStat | null {
    return this.filteredRules.find((r) => r.id === this.selectedRuleId) ?? this.filteredRules[0] ?? null;
  }

  get selectedLocation(): SarifLocationStat | null {
    return this.filteredLocations.find((l) => l.file === this.selectedFile) ?? this.filteredLocations[0] ?? null;
  }

  get ruleResults(): SarifResult[] {
    const rule = this.selectedRule;
    if (!rule || !this.parsed) return [];
    return this.parsed.results.filter((r) => r.ruleId === rule.id);
  }

  get locationResults(): SarifResult[] {
    const loc = this.selectedLocation;
    if (!loc || !this.parsed) return [];
    return this.parsed.results.filter((r) => (r.file || '(no file)') === loc.file);
  }

  get resultMetadataRows() {
    return this.selectedResult ? buildSarifResultMetadata(this.selectedResult) : [];
  }

  get ruleMetadataRows() {
    return this.selectedRule ? buildSarifRuleMetadata(this.selectedRule) : [];
  }

  get locationMetadataRows() {
    return this.selectedLocation ? buildSarifLocationMetadata(this.selectedLocation) : [];
  }

  get primarySuggestion() {
    const s = resolveSarifSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  levelTint(level: string): string {
    return sarifLevelColor(level);
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
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.viewMode === 'rules') this.shiftRule(1);
      else if (this.viewMode === 'locations') this.shiftLocation(1);
      else this.shiftResult(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'rules') this.shiftRule(-1);
      else if (this.viewMode === 'locations') this.shiftLocation(-1);
      else this.shiftResult(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: SarifLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByResult(_i: number, result: SarifResult): string {
    return result.id;
  }

  trackByRule(_i: number, rule: SarifRuleStat): string {
    return rule.id;
  }

  trackByLocation(_i: number, location: SarifLocationStat): string {
    return location.file;
  }

  formatSize(bytes: number): string {
    return formatSarifFileSize(bytes);
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
    const { accepted, rejected } = filterValidSarifFiles(files);
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
          const bytes = await readSarifFileBytes(file);
          const record = createSarifFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid SARIF report'}`;
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
    await this.handleFiles([createSampleSarifFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectResult(id: string): void {
    this.selectedId = id;
    const result = this.filteredResults.find((r) => r.id === id);
    if (result) {
      this.selectedRuleId = result.ruleId;
      this.selectedFile = result.file || '(no file)';
    }
    this.cdr.markForCheck();
  }

  selectRule(id: string): void {
    this.selectedRuleId = id;
    const first = this.ruleResults[0];
    if (first) this.selectedId = first.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectLocation(file: string): void {
    this.selectedFile = file;
    const first = this.locationResults[0];
    if (first) this.selectedId = first.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const first = this.filteredResults[0];
    if (first && !this.filteredResults.some((r) => r.id === this.selectedId)) this.selectedId = first.id;
    const rule = this.filteredRules[0];
    if (rule && !this.filteredRules.some((r) => r.id === this.selectedRuleId)) this.selectedRuleId = rule.id;
    const loc = this.filteredLocations[0];
    if (loc && !this.filteredLocations.some((l) => l.file === this.selectedFile)) this.selectedFile = loc.file;
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
    this.selectedId = '';
    this.selectedRuleId = '';
    this.selectedFile = '';
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

  setViewMode(mode: SarifViewMode): void {
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

  exportAs(format: SarifExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportSarifSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'results-csv') downloadTextFile(exportSarifResultsCsv(file.parsed), `${file.name}.results.csv`, 'text/csv');
      else if (format === 'rules-csv') downloadTextFile(exportSarifRulesCsv(file.parsed), `${file.name}.rules.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || (this.viewMode !== 'rules' && this.viewMode !== 'locations')) {
          this.toast.info('Open Rules or Locations to export a PNG snapshot');
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

  private shiftResult(delta: number): void {
    const list = this.filteredResults;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((r) => r.id === this.selectedId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectResult(next.id);
  }

  private shiftRule(delta: number): void {
    const list = this.filteredRules;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((r) => r.id === this.selectedRuleId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectRule(next.id);
  }

  private shiftLocation(delta: number): void {
    const list = this.filteredLocations;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((l) => l.file === this.selectedFile));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectLocation(next.file);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedId = this.parsed?.results[0]?.id ?? '';
    this.selectedRuleId = this.parsed?.rules[0]?.id ?? '';
    this.selectedFile = this.parsed?.locations[0]?.file ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || (this.viewMode !== 'rules' && this.viewMode !== 'locations')) return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(280, parent.clientHeight || 220));
    }
    if (this.viewMode === 'rules') renderSarifRules(canvas, this.filteredRules, this.selectedRule?.id ?? null);
    else renderSarifLocations(canvas, this.filteredLocations, this.selectedLocation?.file ?? null);
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

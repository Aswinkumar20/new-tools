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
  NESSUS_ACCEPT_ATTR,
  NESSUS_FORMATS_HINT,
  NESSUS_FORMATS_LABEL,
  NESSUS_RELATED_TOOLS,
  NESSUS_SUPPORTED_EXTENSIONS
} from '../../constants/nessus-report-viewer.constants';
import type {
  NessusExportFormat,
  NessusFinding,
  NessusHostStat,
  NessusLoadedFile,
  NessusViewMode
} from '../../types/nessus-report-viewer.types';
import {
  buildNessusFindingMetadata,
  buildNessusHostMetadata,
  buildNessusMetadataRows,
  canExportNessus,
  canvasToPngDataUrl,
  createNessusFileRecord,
  createSampleNessusFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportNessusFindingsCsv,
  exportNessusHostsCsv,
  exportNessusSummaryJson,
  filterNessusFindings,
  filterValidNessusFiles,
  formatNessusFileSize,
  nessusSeverityColor,
  readNessusFileBytes,
  renderNessusHosts,
  renderNessusSeverity,
  resolveNessusSuggestion
} from '../../utils/nessus-report-viewer.utils';

@Component({
  selector: 'lib-nessus-report-viewer',
  standalone: true,
  templateUrl: './nessus-report-viewer.html',
  styleUrls: ['./nessus-report-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NessusReportViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = NESSUS_ACCEPT_ATTR;
  readonly relatedTools = NESSUS_RELATED_TOOLS;
  readonly supportedExtensions = NESSUS_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = NESSUS_FORMATS_LABEL;
  readonly formatsHint = NESSUS_FORMATS_HINT;
  readonly viewModes: Array<{ id: NessusViewMode; label: string }> = [
    { id: 'findings', label: 'Findings' },
    { id: 'hosts', label: 'Hosts' },
    { id: 'severity', label: 'Severity' },
    { id: 'table', label: 'Table' }
  ];

  files: NessusLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: NessusViewMode = 'findings';
  query = '';
  selectedId = '';
  selectedHostName = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): NessusLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportNessus(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildNessusMetadataRows(this.parsed) : [];
  }

  get filteredFindings(): NessusFinding[] {
    return this.parsed ? filterNessusFindings(this.parsed.findings, this.query) : [];
  }

  get selectedFinding(): NessusFinding | null {
    return this.filteredFindings.find((f) => f.id === this.selectedId) ?? this.filteredFindings[0] ?? null;
  }

  get selectedHost(): NessusHostStat | null {
    if (!this.parsed) return null;
    return this.parsed.hosts.find((h) => h.name === this.selectedHostName) ?? this.parsed.hosts[0] ?? null;
  }

  get hostFindings(): NessusFinding[] {
    const host = this.selectedHost;
    if (!host || !this.parsed) return [];
    return this.parsed.findings.filter((f) => f.host === host.name || f.ip === host.ip);
  }

  get findingMetadataRows() {
    return this.selectedFinding ? buildNessusFindingMetadata(this.selectedFinding) : [];
  }

  get hostMetadataRows() {
    return this.selectedHost ? buildNessusHostMetadata(this.selectedHost) : [];
  }

  get primarySuggestion() {
    const s = resolveNessusSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  severityTint(severity: string): string {
    return nessusSeverityColor(severity);
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
      if (this.viewMode === 'hosts') this.shiftHost(1);
      else this.shiftFinding(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'hosts') this.shiftHost(-1);
      else this.shiftFinding(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: NessusLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByFinding(_i: number, finding: NessusFinding): string {
    return finding.id;
  }

  trackByHost(_i: number, host: NessusHostStat): string {
    return host.name;
  }

  formatSize(bytes: number): string {
    return formatNessusFileSize(bytes);
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
    const { accepted, rejected } = filterValidNessusFiles(files);
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
          const bytes = await readNessusFileBytes(file);
          const record = createNessusFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid Nessus report'}`;
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
    await this.handleFiles([createSampleNessusFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectFinding(id: string): void {
    this.selectedId = id;
    const finding = this.filteredFindings.find((f) => f.id === id);
    if (finding) this.selectedHostName = finding.host || finding.ip;
    this.cdr.markForCheck();
  }

  selectHost(name: string): void {
    this.selectedHostName = name;
    const first = this.hostFindings[0];
    if (first) this.selectedId = first.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const first = this.filteredFindings[0];
    if (first && !this.filteredFindings.some((f) => f.id === this.selectedId)) this.selectedId = first.id;
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
    this.selectedHostName = '';
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

  setViewMode(mode: NessusViewMode): void {
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

  exportAs(format: NessusExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportNessusSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'findings-csv') downloadTextFile(exportNessusFindingsCsv(file.parsed), `${file.name}.findings.csv`, 'text/csv');
      else if (format === 'hosts-csv') downloadTextFile(exportNessusHostsCsv(file.parsed), `${file.name}.hosts.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || (this.viewMode !== 'hosts' && this.viewMode !== 'severity')) {
          this.toast.info('Open Hosts or Severity to export a PNG snapshot');
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

  private shiftFinding(delta: number): void {
    const list = this.filteredFindings;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((f) => f.id === this.selectedId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectFinding(next.id);
  }

  private shiftHost(delta: number): void {
    const list = this.parsed?.hosts ?? [];
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((h) => h.name === this.selectedHostName));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectHost(next.name);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedId = this.parsed?.findings[0]?.id ?? '';
    this.selectedHostName = this.parsed?.hosts[0]?.name ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || (this.viewMode !== 'hosts' && this.viewMode !== 'severity')) return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(280, parent.clientHeight || 220));
    }
    if (this.viewMode === 'hosts') renderNessusHosts(canvas, this.parsed.hosts, this.selectedHost?.name ?? null);
    else renderNessusSeverity(canvas, this.parsed.severities);
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

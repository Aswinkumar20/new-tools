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
  NMAP_ACCEPT_ATTR,
  NMAP_FORMATS_HINT,
  NMAP_FORMATS_LABEL,
  NMAP_RELATED_TOOLS,
  NMAP_SUPPORTED_EXTENSIONS
} from '../../constants/nmap-report-viewer.constants';
import type {
  NmapExportFormat,
  NmapHost,
  NmapLoadedFile,
  NmapPort,
  NmapViewMode
} from '../../types/nmap-report-viewer.types';
import {
  buildNmapHostMetadata,
  buildNmapMetadataRows,
  buildNmapPortMetadata,
  canExportNmap,
  canvasToPngDataUrl,
  createNmapFileRecord,
  createSampleNmapFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportNmapHostsCsv,
  exportNmapPortsCsv,
  exportNmapSummaryJson,
  filterNmapHosts,
  filterNmapPorts,
  filterValidNmapFiles,
  formatNmapFileSize,
  nmapServiceColor,
  nmapStateColor,
  readNmapFileBytes,
  renderNmapHosts,
  renderNmapServices,
  resolveNmapSuggestion
} from '../../utils/nmap-report-viewer.utils';

@Component({
  selector: 'lib-nmap-report-viewer',
  standalone: true,
  templateUrl: './nmap-report-viewer.html',
  styleUrls: ['./nmap-report-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NmapReportViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = NMAP_ACCEPT_ATTR;
  readonly relatedTools = NMAP_RELATED_TOOLS;
  readonly supportedExtensions = NMAP_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = NMAP_FORMATS_LABEL;
  readonly formatsHint = NMAP_FORMATS_HINT;
  readonly viewModes: Array<{ id: NmapViewMode; label: string }> = [
    { id: 'hosts', label: 'Hosts' },
    { id: 'ports', label: 'Ports' },
    { id: 'services', label: 'Services' },
    { id: 'table', label: 'Table' }
  ];

  files: NmapLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: NmapViewMode = 'hosts';
  query = '';
  selectedHostId = '';
  selectedPortId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): NmapLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportNmap(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildNmapMetadataRows(this.parsed) : [];
  }

  get filteredHosts(): NmapHost[] {
    return this.parsed ? filterNmapHosts(this.parsed.hosts, this.query) : [];
  }

  get filteredPorts(): NmapPort[] {
    return this.parsed ? filterNmapPorts(this.parsed.ports, this.query) : [];
  }

  get selectedHost(): NmapHost | null {
    return this.filteredHosts.find((h) => h.id === this.selectedHostId) ?? this.filteredHosts[0] ?? null;
  }

  get selectedPort(): NmapPort | null {
    return this.filteredPorts.find((p) => p.id === this.selectedPortId) ?? this.filteredPorts[0] ?? null;
  }

  get hostPorts(): NmapPort[] {
    return this.selectedHost?.ports ?? [];
  }

  get hostMetadataRows() {
    return this.selectedHost ? buildNmapHostMetadata(this.selectedHost) : [];
  }

  get portMetadataRows() {
    return this.selectedPort ? buildNmapPortMetadata(this.selectedPort) : [];
  }

  get primarySuggestion() {
    const s = resolveNmapSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  stateTint(state: string): string {
    return nmapStateColor(state);
  }

  serviceTint(name: string, index = 0): string {
    return nmapServiceColor(name, index);
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
      if (this.viewMode === 'ports' || this.viewMode === 'table') this.shiftPort(1);
      else this.shiftHost(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'ports' || this.viewMode === 'table') this.shiftPort(-1);
      else this.shiftHost(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: NmapLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByHost(_i: number, host: NmapHost): string {
    return host.id;
  }

  trackByPort(_i: number, port: NmapPort): string {
    return port.id;
  }

  formatSize(bytes: number): string {
    return formatNmapFileSize(bytes);
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
    const { accepted, rejected } = filterValidNmapFiles(files);
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
          const bytes = await readNmapFileBytes(file);
          const record = createNmapFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid Nmap report'}`;
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
    await this.handleFiles([createSampleNmapFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectHost(id: string): void {
    this.selectedHostId = id;
    const first = this.hostPorts[0];
    if (first) this.selectedPortId = first.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectPort(id: string): void {
    this.selectedPortId = id;
    const port = this.filteredPorts.find((p) => p.id === id);
    if (port) this.selectedHostId = port.hostId;
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const firstHost = this.filteredHosts[0];
    if (firstHost && !this.filteredHosts.some((h) => h.id === this.selectedHostId)) this.selectedHostId = firstHost.id;
    const firstPort = this.filteredPorts[0];
    if (firstPort && !this.filteredPorts.some((p) => p.id === this.selectedPortId)) this.selectedPortId = firstPort.id;
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
    this.selectedHostId = '';
    this.selectedPortId = '';
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

  setViewMode(mode: NmapViewMode): void {
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

  exportAs(format: NmapExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportNmapSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'hosts-csv') downloadTextFile(exportNmapHostsCsv(file.parsed), `${file.name}.hosts.csv`, 'text/csv');
      else if (format === 'ports-csv') downloadTextFile(exportNmapPortsCsv(file.parsed), `${file.name}.ports.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || (this.viewMode !== 'hosts' && this.viewMode !== 'services')) {
          this.toast.info('Open Hosts or Services to export a PNG snapshot');
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

  private shiftHost(delta: number): void {
    const list = this.filteredHosts;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((h) => h.id === this.selectedHostId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectHost(next.id);
  }

  private shiftPort(delta: number): void {
    const list = this.filteredPorts;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((p) => p.id === this.selectedPortId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectPort(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedHostId = this.parsed?.hosts[0]?.id ?? '';
    this.selectedPortId = this.parsed?.ports[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || (this.viewMode !== 'hosts' && this.viewMode !== 'services')) return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(280, parent.clientHeight || 220));
    }
    if (this.viewMode === 'hosts') renderNmapHosts(canvas, this.filteredHosts, this.selectedHost?.id ?? null);
    else renderNmapServices(canvas, this.parsed.services);
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

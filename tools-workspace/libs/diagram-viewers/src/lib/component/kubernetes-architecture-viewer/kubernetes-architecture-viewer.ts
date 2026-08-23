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
import { AssetService, Navigation, StatValueTooltipHostDirective, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import { buildDiagramInsightStats } from '../../utils/diagram-file.utils';
import {
  K8S_ACCEPT_ATTR,
  K8S_FORMATS_HINT,
  K8S_FORMATS_LABEL,
  K8S_RELATED_TOOLS,
  K8S_SUPPORTED_EXTENSIONS
} from '../../constants/kubernetes-architecture-viewer.constants';
import type {
  K8sExportFormat,
  K8sLink,
  K8sLoadedFile,
  K8sService,
  K8sViewMode,
  K8sWorkload
} from '../../types/kubernetes-architecture-viewer.types';
import {
  buildK8sLinkMetadata,
  buildK8sMetadataRows,
  buildK8sServiceMetadata,
  buildK8sWorkloadMetadata,
  canExportK8s,
  canvasToPngDataUrl,
  createK8sFileRecord,
  createSampleK8sFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportK8sServicesCsv,
  exportK8sSummaryJson,
  exportK8sWorkloadsCsv,
  filterK8sLinks,
  filterK8sServices,
  filterK8sWorkloads,
  filterValidK8sFiles,
  formatK8sFileSize,
  k8sNodeColor,
  readK8sFileBytes,
  renderK8sDiagram,
  renderK8sLinks,
  renderK8sServices,
  renderK8sWorkloads,
  resolveK8sSuggestion
} from '../../utils/kubernetes-architecture-viewer.utils';

@Component({
  selector: 'lib-kubernetes-architecture-viewer',
  standalone: true,
  templateUrl: './kubernetes-architecture-viewer.html',
  styleUrls: ['./kubernetes-architecture-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KubernetesArchitectureViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = K8S_ACCEPT_ATTR;
  readonly relatedTools = K8S_RELATED_TOOLS;
  readonly supportedExtensions = K8S_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = K8S_FORMATS_LABEL;
  readonly formatsHint = K8S_FORMATS_HINT;
  readonly viewModes: Array<{ id: K8sViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'workloads', label: 'Workloads' },
    { id: 'services', label: 'Services' },
    { id: 'table', label: 'Table' }
  ];

  files: K8sLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: K8sViewMode = 'diagram';
  query = '';
  selectedWorkloadId = '';
  selectedServiceId = '';
  selectedLinkId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): K8sLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportK8s(this.currentFile);
  }

  get insights() {
    return buildDiagramInsightStats(
      this.parsed as Record<string, unknown> | null,
      this.files.length,
      this.currentFile?.size ?? null,
      this.warnings,
      (n) => this.formatSize(n)
    );
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get selectedWorkload(): K8sWorkload | null {
    return this.parsed?.workloads.find((w) => w.id === this.selectedWorkloadId) ?? null;
  }

  get selectedService(): K8sService | null {
    return this.parsed?.services.find((s) => s.id === this.selectedServiceId) ?? null;
  }

  get selectedLink(): K8sLink | null {
    return this.parsed?.links.find((l) => l.id === this.selectedLinkId) ?? null;
  }

  get filteredWorkloads(): K8sWorkload[] {
    return this.parsed ? filterK8sWorkloads(this.parsed.workloads, this.query) : [];
  }

  get filteredServices(): K8sService[] {
    return this.parsed ? filterK8sServices(this.parsed.services, this.query) : [];
  }

  get filteredLinks(): K8sLink[] {
    return this.parsed ? filterK8sLinks(this.parsed.links, this.query) : [];
  }

  get metadataRows() {
    return this.parsed ? buildK8sMetadataRows(this.parsed) : [];
  }

  get workloadMetadataRows() {
    return this.selectedWorkload ? buildK8sWorkloadMetadata(this.selectedWorkload) : [];
  }

  get serviceMetadataRows() {
    return this.selectedService ? buildK8sServiceMetadata(this.selectedService) : [];
  }

  get linkMetadataRows() {
    return this.selectedLink ? buildK8sLinkMetadata(this.selectedLink) : [];
  }

  get primarySuggestion() {
    const s = resolveK8sSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(kind: string, index: number): string {
    return k8sNodeColor(kind, index);
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
      if (this.viewMode === 'table') this.shiftLink(1);
      else if (this.viewMode === 'services') this.shiftService(1);
      else this.shiftWorkload(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftLink(-1);
      else if (this.viewMode === 'services') this.shiftService(-1);
      else this.shiftWorkload(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: K8sLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByWorkload(_i: number, workload: K8sWorkload): string {
    return workload.id;
  }

  trackByService(_i: number, service: K8sService): string {
    return service.id;
  }

  trackByLink(_i: number, link: K8sLink): string {
    return link.id;
  }

  formatSize(bytes: number): string {
    return formatK8sFileSize(bytes);
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
    const { accepted, rejected } = filterValidK8sFiles(files);
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
          const bytes = await readK8sFileBytes(file);
          const record = createK8sFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid Kubernetes manifest'}`;
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
    await this.handleFiles([createSampleK8sFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectWorkload(id: string): void {
    this.selectedWorkloadId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectService(id: string): void {
    this.selectedServiceId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectLink(id: string): void {
    this.selectedLinkId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const wl = this.filteredWorkloads[0];
    if (wl && !this.filteredWorkloads.some((w) => w.id === this.selectedWorkloadId)) this.selectedWorkloadId = wl.id;
    const svc = this.filteredServices[0];
    if (svc && !this.filteredServices.some((s) => s.id === this.selectedServiceId)) this.selectedServiceId = svc.id;
    const link = this.filteredLinks[0];
    if (link && !this.filteredLinks.some((l) => l.id === this.selectedLinkId)) this.selectedLinkId = link.id;
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
    this.selectedWorkloadId = '';
    this.selectedServiceId = '';
    this.selectedLinkId = '';
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

  setViewMode(mode: K8sViewMode): void {
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

  exportAs(format: K8sExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportK8sSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'workloads-csv') downloadTextFile(exportK8sWorkloadsCsv(file.parsed), `${file.name}.workloads.csv`, 'text/csv');
      else if (format === 'services-csv') downloadTextFile(exportK8sServicesCsv(file.parsed), `${file.name}.services.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, Workloads, or Services to export a PNG snapshot');
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

  private shiftWorkload(delta: number): void {
    const list = this.filteredWorkloads;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((w) => w.id === this.selectedWorkloadId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectWorkload(next.id);
  }

  private shiftService(delta: number): void {
    const list = this.filteredServices;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedServiceId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectService(next.id);
  }

  private shiftLink(delta: number): void {
    const list = this.filteredLinks;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((l) => l.id === this.selectedLinkId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectLink(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedWorkloadId = this.parsed?.workloads[0]?.id ?? '';
    this.selectedServiceId = this.parsed?.services[0]?.id ?? '';
    this.selectedLinkId = this.parsed?.links[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'diagram' ? 280 : 220, parent.clientHeight || 240));
    }
    if (this.viewMode === 'diagram') {
      renderK8sDiagram(canvas, this.parsed.workloads, this.parsed.services, this.parsed.links, this.selectedWorkloadId || this.selectedServiceId || null);
    } else if (this.viewMode === 'workloads') {
      renderK8sWorkloads(canvas, this.filteredWorkloads, this.selectedWorkloadId || null);
    } else if (this.viewMode === 'services') {
      renderK8sServices(canvas, this.filteredServices, this.selectedServiceId || null);
    } else renderK8sLinks(canvas, this.filteredLinks, this.selectedLinkId || null);
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

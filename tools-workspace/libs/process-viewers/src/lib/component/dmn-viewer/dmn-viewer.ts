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
  DMN_ACCEPT_ATTR,
  DMN_FORMATS_HINT,
  DMN_FORMATS_LABEL,
  DMN_RELATED_TOOLS,
  DMN_SUPPORTED_EXTENSIONS
} from '../../constants/dmn-viewer.constants';
import type {
  DmnDecisionTable,
  DmnDrdNode,
  DmnExportFormat,
  DmnLoadedFile,
  DmnRule,
  DmnViewMode
} from '../../types/dmn-viewer.types';
import {
  buildDmnMetadataRows,
  buildDmnNodeMetadata,
  buildDmnRuleMetadata,
  buildDmnTableMetadata,
  canExportDmn,
  canvasToPngDataUrl,
  createDmnFileRecord,
  createSampleDmnFile,
  dmnHitPolicyColor,
  dmnNodeKindColor,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportDmnRulesCsv,
  exportDmnSummaryJson,
  exportDmnTablesCsv,
  filterDmnNodes,
  filterDmnRules,
  filterDmnTables,
  filterValidDmnFiles,
  formatDmnFileSize,
  readDmnFileBytes,
  renderDmnDrd,
  renderDmnHitPolicies,
  resolveDmnSuggestion
} from '../../utils/dmn-viewer.utils';

@Component({
  selector: 'lib-dmn-viewer',
  standalone: true,
  templateUrl: './dmn-viewer.html',
  styleUrls: ['./dmn-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DmnViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = DMN_ACCEPT_ATTR;
  readonly relatedTools = DMN_RELATED_TOOLS;
  readonly supportedExtensions = DMN_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = DMN_FORMATS_LABEL;
  readonly formatsHint = DMN_FORMATS_HINT;
  readonly viewModes: Array<{ id: DmnViewMode; label: string }> = [
    { id: 'tables', label: 'Tables' },
    { id: 'drd', label: 'DRD' },
    { id: 'rules', label: 'Rules' },
    { id: 'table', label: 'Table' }
  ];

  files: DmnLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: DmnViewMode = 'tables';
  query = '';
  selectedTableId = '';
  selectedRuleId = '';
  selectedNodeId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): DmnLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportDmn(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildDmnMetadataRows(this.parsed) : [];
  }

  get filteredTables(): DmnDecisionTable[] {
    return this.parsed ? filterDmnTables(this.parsed.tables, this.query) : [];
  }

  get filteredRules(): DmnRule[] {
    return this.parsed ? filterDmnRules(this.parsed.rules, this.query) : [];
  }

  get filteredNodes(): DmnDrdNode[] {
    return this.parsed ? filterDmnNodes(this.parsed.nodes, this.query) : [];
  }

  get selectedTable(): DmnDecisionTable | null {
    return this.filteredTables.find((t) => t.id === this.selectedTableId) ?? this.filteredTables[0] ?? null;
  }

  get selectedRule(): DmnRule | null {
    return this.filteredRules.find((r) => r.id === this.selectedRuleId) ?? this.filteredRules[0] ?? null;
  }

  get selectedNode(): DmnDrdNode | null {
    return this.filteredNodes.find((n) => n.id === this.selectedNodeId) ?? this.filteredNodes[0] ?? null;
  }

  get tableMetadataRows() {
    return this.selectedTable ? buildDmnTableMetadata(this.selectedTable) : [];
  }

  get ruleMetadataRows() {
    return this.selectedRule ? buildDmnRuleMetadata(this.selectedRule) : [];
  }

  get nodeMetadataRows() {
    return this.selectedNode ? buildDmnNodeMetadata(this.selectedNode) : [];
  }

  get primarySuggestion() {
    const s = resolveDmnSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  policyTint(policy: string): string {
    return dmnHitPolicyColor(policy);
  }

  kindTint(kind: string): string {
    return dmnNodeKindColor(kind);
  }

  clauseLabels(table: DmnDecisionTable, which: 'inputs' | 'outputs'): string {
    const labels = (which === 'inputs' ? table.inputs : table.outputs).map((c) => c.label).filter(Boolean);
    return labels.join(', ') || '—';
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
      if (this.viewMode === 'tables') this.shiftTable(1);
      else if (this.viewMode === 'drd') this.shiftNode(1);
      else this.shiftRule(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'tables') this.shiftTable(-1);
      else if (this.viewMode === 'drd') this.shiftNode(-1);
      else this.shiftRule(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: DmnLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByTable(_i: number, table: DmnDecisionTable): string {
    return table.id;
  }

  trackByRule(_i: number, rule: DmnRule): string {
    return rule.id;
  }

  trackByNode(_i: number, node: DmnDrdNode): string {
    return node.id;
  }

  formatSize(bytes: number): string {
    return formatDmnFileSize(bytes);
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
    const { accepted, rejected } = filterValidDmnFiles(files);
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
          const bytes = await readDmnFileBytes(file);
          const record = createDmnFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid DMN model'}`;
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
    await this.handleFiles([createSampleDmnFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectTable(id: string): void {
    this.selectedTableId = id;
    const first = this.filteredRules.find((r) => r.tableId === id);
    if (first) this.selectedRuleId = first.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRule(id: string): void {
    this.selectedRuleId = id;
    const rule = this.filteredRules.find((r) => r.id === id);
    if (rule) this.selectedTableId = rule.tableId;
    this.cdr.markForCheck();
  }

  selectNode(id: string): void {
    this.selectedNodeId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const table = this.filteredTables[0];
    if (table && !this.filteredTables.some((t) => t.id === this.selectedTableId)) this.selectedTableId = table.id;
    const rule = this.filteredRules[0];
    if (rule && !this.filteredRules.some((r) => r.id === this.selectedRuleId)) this.selectedRuleId = rule.id;
    const node = this.filteredNodes[0];
    if (node && !this.filteredNodes.some((n) => n.id === this.selectedNodeId)) this.selectedNodeId = node.id;
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
    this.selectedTableId = '';
    this.selectedRuleId = '';
    this.selectedNodeId = '';
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

  setViewMode(mode: DmnViewMode): void {
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

  exportAs(format: DmnExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportDmnSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'rules-csv') downloadTextFile(exportDmnRulesCsv(file.parsed), `${file.name}.rules.csv`, 'text/csv');
      else if (format === 'tables-csv') downloadTextFile(exportDmnTablesCsv(file.parsed), `${file.name}.tables.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || (this.viewMode !== 'tables' && this.viewMode !== 'drd')) {
          this.toast.info('Open Tables or DRD to export a PNG snapshot');
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

  private shiftTable(delta: number): void {
    const list = this.filteredTables;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((t) => t.id === this.selectedTableId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectTable(next.id);
  }

  private shiftRule(delta: number): void {
    const list = this.filteredRules;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((r) => r.id === this.selectedRuleId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectRule(next.id);
  }

  private shiftNode(delta: number): void {
    const list = this.filteredNodes;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((n) => n.id === this.selectedNodeId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectNode(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedTableId = this.parsed?.tables[0]?.id ?? '';
    this.selectedRuleId = this.parsed?.rules[0]?.id ?? '';
    this.selectedNodeId = this.parsed?.nodes[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || (this.viewMode !== 'tables' && this.viewMode !== 'drd')) return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(280, parent.clientHeight || 220));
    }
    if (this.viewMode === 'tables') renderDmnHitPolicies(canvas, this.parsed.hitPolicies, this.selectedTable?.hitPolicy ?? null);
    else renderDmnDrd(canvas, this.filteredNodes, this.selectedNode?.id ?? null);
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

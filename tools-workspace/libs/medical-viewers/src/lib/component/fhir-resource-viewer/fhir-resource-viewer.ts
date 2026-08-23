import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import {
  FHIR_ACCEPT_ATTR,
  FHIR_FORMATS_HINT,
  FHIR_FORMATS_LABEL,
  FHIR_RELATED_TOOLS,
  FHIR_SUPPORTED_EXTENSIONS
} from '../../constants/fhir-resource-viewer.constants';
import type {
  FhirExportFormat,
  FhirLoadedResource,
  FhirReference,
  FhirTimelineEvent,
  FhirTreeNode,
  FhirViewTab
} from '../../types/fhir-resource-viewer.types';
import {
  canExportFhir,
  collectTreeNodeIds,
  createFhirResourceRecord,
  createSampleFhirFile,
  defaultExpandedTreeIds,
  downloadBinaryFile,
  downloadTextFile,
  exportFhirReferencesJson,
  exportFhirSummaryJson,
  exportFhirTimelineJson,
  filterFhirReferences,
  filterFhirTimeline,
  filterValidFhirFiles,
  findMatchingTreeNodeIds,
  flattenVisibleTreeNodes,
  formatFhirFileSize,
  readFhirFileBytes,
  resolveFhirSuggestion
} from '../../utils/fhir-resource-viewer.utils';
import {
  clipboardFiles,
  clipboardText,
  fileFromPastedText,
  looksLikeFhirText
} from '../../utils/clinical-document.utils';

@Component({
  selector: 'lib-fhir-resource-viewer',
  standalone: true,
  templateUrl: './fhir-resource-viewer.html',
  styleUrls: ['./fhir-resource-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FhirResourceViewerComponent {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('contentSearchInput') contentSearchInput!: ElementRef<HTMLInputElement>;

  readonly acceptAttr = FHIR_ACCEPT_ATTR;
  readonly relatedTools = FHIR_RELATED_TOOLS;
  readonly supportedExtensions = FHIR_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = FHIR_FORMATS_LABEL;
  readonly formatsHint = FHIR_FORMATS_HINT;
  readonly viewTabs: ReadonlyArray<{ id: FhirViewTab; label: string }> = [
    { id: 'tree', label: 'Resource tree' },
    { id: 'references', label: 'References' },
    { id: 'timeline', label: 'Timeline' }
  ];

  resources: FhirLoadedResource[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  activeTab: FhirViewTab = 'tree';
  contentQuery = '';
  expandedTreeIds = new Set<string>();
  selectedTreeNodeId: string | null = null;

  private dragDepth = 0;

  get currentResource(): FhirLoadedResource | null {
    return this.currentIndex >= 0 ? this.resources[this.currentIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportFhir(this.currentResource);
  }

  get warnings(): string[] {
    return this.currentResource?.warnings ?? [];
  }

  get primarySuggestion() {
    const suggestion = resolveFhirSuggestion({
      hasResources: this.resources.length > 0,
      hasError: !!this.errorMessage
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) return null;
    return suggestion;
  }

  get visibleTreeRows(): Array<{ node: FhirTreeNode; depth: number }> {
    const resource = this.currentResource;
    if (!resource) return [];
    const q = this.contentQuery.trim();
    if (!q) return flattenVisibleTreeNodes(resource.parsed.tree, this.expandedTreeIds);
    const matchIds = findMatchingTreeNodeIds(resource.parsed.tree, q);
    const expanded = new Set(this.expandedTreeIds);
    matchIds.forEach((id) => expanded.add(id));
    return flattenVisibleTreeNodes(resource.parsed.tree, expanded).filter(({ node }) => matchIds.has(node.id));
  }

  get filteredReferences(): FhirReference[] {
    const resource = this.currentResource;
    if (!resource) return [];
    return filterFhirReferences(resource.parsed.references, this.contentQuery);
  }

  get filteredTimeline(): FhirTimelineEvent[] {
    const resource = this.currentResource;
    if (!resource) return [];
    return filterFhirTimeline(resource.parsed.timeline, this.contentQuery);
  }

  get resourceSummaryLabel(): string {
    const resource = this.currentResource;
    if (!resource) return '';
    const p = resource.parsed;
    const idPart = p.primaryId ? `#${p.primaryId}` : '';
    return `${p.primaryResourceType}${idPart} · ${p.resources.length} resource(s)`;
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

  @HostListener('window:paste', ['$event'])
  async onWindowPaste(event: ClipboardEvent): Promise<void> {
    if (this.isTypingTarget(event.target)) return;
    const files = clipboardFiles(event);
    if (files.length) {
      event.preventDefault();
      await this.handleFiles(files);
      return;
    }
    const text = clipboardText(event);
    if (!looksLikeFhirText(text)) return;
    const file = fileFromPastedText(
      text,
      text.trim().startsWith('<') ? 'pasted-resource.xml' : 'pasted-resource.json',
      text.trim().startsWith('<') ? 'application/xml' : 'application/json'
    );
    if (!file) return;
    event.preventDefault();
    await this.handleFiles([file]);
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.currentResource || this.isTypingTarget(event.target)) return;
    if (event.key === '/') {
      event.preventDefault();
      this.contentSearchInput?.nativeElement?.focus();
    }
  }

  trackByResourceId(_index: number, item: FhirLoadedResource): string {
    return item.id;
  }

  trackByTreeNodeId(_index: number, row: { node: FhirTreeNode }): string {
    return row.node.id;
  }

  trackByReferenceId(_index: number, ref: FhirReference): string {
    return ref.id;
  }

  trackByTimelineId(_index: number, event: FhirTimelineEvent): string {
    return event.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatFhirFileSize(bytes);
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
    const { accepted, rejected } = filterValidFhirFiles(files);
    for (const item of rejected) this.toast.error(`${item.name}: ${item.reason}`);
    if (!accepted.length) {
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      const loaded: FhirLoadedResource[] = [];
      for (const file of accepted) {
        try {
          const bytes = await readFhirFileBytes(file);
          loaded.push(createFhirResourceRecord(file, bytes));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid FHIR document';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }

      if (loaded.length) {
        const merged = [...this.resources, ...loaded];
        const byId = new Map<string, FhirLoadedResource>();
        for (const item of merged) byId.set(item.id, item);
        this.resources = Array.from(byId.values());
        this.currentIndex = Math.min(
          Math.max(0, this.resources.length - loaded.length),
          this.resources.length - 1
        );
        this.resetViewState();
        const current = this.currentResource;
        if (current) {
          this.toast.success(`Loaded ${current.name}`);
          if (current.warnings.length) {
            this.toast.info(`${current.warnings.length} note(s) about this document`);
          }
        }
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load FHIR document';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleFhirFile()]);
  }

  selectResource(index: number): void {
    if (index < 0 || index >= this.resources.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewState();
    this.cdr.markForCheck();
  }

  removeResource(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.resources.length) return;
    const next = this.resources.filter((_, i) => i !== index);
    this.resources = next;
    if (!next.length) {
      this.clearAll();
      return;
    }
    if (this.currentIndex >= next.length) this.currentIndex = next.length - 1;
    else if (index < this.currentIndex) this.currentIndex -= 1;
    this.resetViewState();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.resources = [];
    this.currentIndex = -1;
    this.errorMessage = '';
    this.resetViewState();
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { id: string }): void {
    if (suggestion.id === 'try-sample') void this.loadSample();
    else if (suggestion.id === 'upload') this.openFilePicker();
  }

  setActiveTab(tab: FhirViewTab): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  onContentQueryChange(): void {
    const resource = this.currentResource;
    const q = this.contentQuery.trim();
    if (!resource || !q) {
      this.cdr.markForCheck();
      return;
    }
    const matchIds = findMatchingTreeNodeIds(resource.parsed.tree, q);
    const next = new Set(this.expandedTreeIds);
    matchIds.forEach((id) => next.add(id));
    this.expandedTreeIds = next;
    this.cdr.markForCheck();
  }

  toggleTreeNode(node: FhirTreeNode, event: Event): void {
    event.stopPropagation();
    if (!node.children?.length) {
      this.selectedTreeNodeId = node.id;
      this.cdr.markForCheck();
      return;
    }
    if (this.expandedTreeIds.has(node.id)) this.expandedTreeIds.delete(node.id);
    else this.expandedTreeIds.add(node.id);
    this.selectedTreeNodeId = node.id;
    this.cdr.markForCheck();
  }

  expandAllTree(): void {
    const resource = this.currentResource;
    if (!resource) return;
    this.expandedTreeIds = new Set(collectTreeNodeIds(resource.parsed.tree));
    this.cdr.markForCheck();
  }

  collapseAllTree(): void {
    this.expandedTreeIds = new Set(['root']);
    this.cdr.markForCheck();
  }

  isTreeExpanded(node: FhirTreeNode): boolean {
    return this.expandedTreeIds.has(node.id);
  }

  nodeValueLabel(node: FhirTreeNode): string {
    if (node.value === null || node.value === undefined) return '';
    return String(node.value);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: FhirExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentResource;
    if (!current) {
      this.toast.error('Nothing to export');
      return;
    }
    const base = current.name.replace(/\.[^.]+$/, '') || 'fhir-resource';
    try {
      if (format === 'original') {
        downloadBinaryFile(
          current.bytes,
          current.name,
          current.format === 'xml' ? 'application/xml' : 'application/json'
        );
        this.toast.success('Exported original file');
      } else if (format === 'summary-json') {
        downloadTextFile(exportFhirSummaryJson(current), `${base}-summary.json`, 'application/json');
        this.toast.success('Exported summary JSON');
      } else if (format === 'references-json') {
        downloadTextFile(exportFhirReferencesJson(current), `${base}-references.json`, 'application/json');
        this.toast.success('Exported references JSON');
      } else if (format === 'timeline-json') {
        downloadTextFile(exportFhirTimelineJson(current), `${base}-timeline.json`, 'application/json');
        this.toast.success('Exported timeline JSON');
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  private resetViewState(): void {
    this.contentQuery = '';
    this.activeTab = 'tree';
    this.selectedTreeNodeId = null;
    const resource = this.currentResource;
    this.expandedTreeIds = resource
      ? defaultExpandedTreeIds(resource.parsed.tree, 2)
      : new Set<string>();
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

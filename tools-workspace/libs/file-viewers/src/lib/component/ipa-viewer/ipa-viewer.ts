import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  IPA_VIEWER_ACCEPT_ATTR,
  IPA_VIEWER_DESCRIPTION,
  IPA_VIEWER_FORMATS_LABEL,
  IPA_VIEWER_HELP_ITEMS,
  IPA_VIEWER_RELATED_TOOLS,
  IPA_VIEWER_TITLE
} from '../../constants/ipa-viewer.constants';
import {
  isIpaFile,
  parseIpaFile,
  resolveIpaSuggestion,
  type IpaInfo
} from '../../utils/ipa-viewer.utils';

const FILE_ENTRY_LIMIT = 50;

@Component({
  selector: 'lib-ipa-viewer',
  standalone: true,
  templateUrl: './ipa-viewer.html',
  styleUrls: ['./ipa-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IpaViewerComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly title = IPA_VIEWER_TITLE;
  readonly description = IPA_VIEWER_DESCRIPTION;
  readonly acceptAttr = IPA_VIEWER_ACCEPT_ATTR;
  readonly formatsLabel = IPA_VIEWER_FORMATS_LABEL;
  readonly helpItems = IPA_VIEWER_HELP_ITEMS;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = IPA_VIEWER_RELATED_TOOLS;

  fileName = '';
  ipa: IpaInfo | null = null;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  dismissedSuggestionId: string | null = null;

  private dragDepth = 0;

  get plistFields(): Array<{ label: string; value: string }> {
    if (!this.ipa) {
      return [];
    }
    return [
      { label: 'App name', value: this.ipa.appName },
      { label: 'Bundle ID', value: this.ipa.bundleId },
      { label: 'Version', value: this.ipa.version },
      { label: 'Build', value: this.ipa.build },
      { label: 'Minimum OS', value: this.ipa.minimumOsVersion }
    ];
  }

  get urlSchemeCount(): number {
    return this.ipa?.urlSchemes.length ?? 0;
  }

  get supportedDeviceCount(): number {
    return this.ipa?.supportedDevices.length ?? 0;
  }

  get fileEntryCount(): number {
    return this.ipa?.fileEntries.length ?? 0;
  }

  get visibleFileEntries(): string[] {
    return (this.ipa?.fileEntries ?? []).slice(0, FILE_ENTRY_LIMIT);
  }

  get hasMoreFileEntries(): boolean {
    return this.fileEntryCount > FILE_ENTRY_LIMIT;
  }

  get primarySuggestion() {
    const suggestion = resolveIpaSuggestion({
      hasIpa: !!this.ipa,
      hasError: !!this.errorMessage
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  ngOnDestroy(): void {
    this.dragDepth = 0;
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      void this.handleFiles(Array.from(input.files));
      input.value = '';
    }
  }

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent): void {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth += 1;
    if (!this.showDropZone) {
      this.showDropZone = true;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0 && this.showDropZone) {
      this.showDropZone = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:drop', ['$event'])
  async onWindowDrop(event: DragEvent): Promise<void> {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropZone = false;
    const files = event.dataTransfer?.files;
    if (files?.length) {
      await this.handleFiles(Array.from(files));
    }
    this.cdr.markForCheck();
  }

  async handleFiles(files: File[]): Promise<void> {
    const valid = files.filter(isIpaFile);
    if (!valid.length) {
      this.errorMessage = `Please upload ${this.formatsLabel} package.`;
      this.dismissedSuggestionId = null;
      this.toast.error(this.errorMessage);
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.cdr.markForCheck();

    try {
      const file = valid[0];
      this.ipa = await parseIpaFile(file);
      this.fileName = file.name;
      this.toast.success(`Loaded ${file.name}`);
    } catch (error) {
      this.ipa = null;
      this.fileName = '';
      this.errorMessage =
        error instanceof Error ? error.message : 'Failed to parse IPA package.';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  clearAll(): void {
    this.ipa = null;
    this.fileName = '';
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.toast.info('IPA cleared');
    this.cdr.markForCheck();
  }

  trackByScheme(_: number, scheme: string): string {
    return scheme;
  }

  trackByDevice(_: number, device: string): string {
    return device;
  }

  trackByFileEntry(_: number, entry: string): string {
    return entry;
  }

  private isFileDrag(event: DragEvent): boolean {
    return !!event.dataTransfer?.types.includes('Files');
  }
}

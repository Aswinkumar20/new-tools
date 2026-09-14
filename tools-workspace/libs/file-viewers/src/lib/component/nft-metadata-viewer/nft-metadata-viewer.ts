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
  NFT_METADATA_ACCEPT_ATTR,
  NFT_METADATA_DESCRIPTION,
  NFT_METADATA_FORMATS_LABEL,
  NFT_METADATA_HELP_ITEMS,
  NFT_METADATA_RELATED_TOOLS,
  NFT_METADATA_TITLE
} from '../../constants/nft-metadata-viewer.constants';
import {
  filterNftTraits,
  isNftMetadataFile,
  parseNftMetadata,
  resolveNftSuggestion,
  type NftMetadata,
  type NftTrait
} from '../../utils/nft-metadata-viewer.utils';

@Component({
  selector: 'lib-nft-metadata-viewer',
  standalone: true,
  templateUrl: './nft-metadata-viewer.html',
  styleUrls: ['./nft-metadata-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftMetadataViewerComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly title = NFT_METADATA_TITLE;
  readonly description = NFT_METADATA_DESCRIPTION;
  readonly acceptAttr = NFT_METADATA_ACCEPT_ATTR;
  readonly formatsLabel = NFT_METADATA_FORMATS_LABEL;
  readonly helpItems = NFT_METADATA_HELP_ITEMS;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = NFT_METADATA_RELATED_TOOLS;

  fileName = '';
  metadata: NftMetadata | null = null;
  traitSearch = '';
  loading = false;
  errorMessage = '';
  showDropZone = false;
  dismissedSuggestionId: string | null = null;
  imageLoadError = false;

  private dragDepth = 0;

  get filteredTraits(): NftTrait[] {
    return filterNftTraits(this.metadata?.traits ?? [], this.traitSearch);
  }

  get traitCount(): number {
    return this.metadata?.traits.length ?? 0;
  }

  get primarySuggestion() {
    const suggestion = resolveNftSuggestion({
      hasMetadata: !!this.metadata,
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
    const valid = files.filter(isNftMetadataFile);
    if (!valid.length) {
      this.errorMessage = `Please upload ${this.formatsLabel} metadata.`;
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
      const content = await file.text();
      this.metadata = parseNftMetadata(content);
      this.fileName = file.name;
      this.traitSearch = '';
      this.imageLoadError = false;
      this.toast.success(`Loaded ${file.name}`);
    } catch (error) {
      this.metadata = null;
      this.fileName = '';
      this.errorMessage =
        error instanceof Error ? error.message : 'Failed to parse NFT metadata JSON.';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  clearAll(): void {
    this.metadata = null;
    this.fileName = '';
    this.traitSearch = '';
    this.errorMessage = '';
    this.imageLoadError = false;
    this.dismissedSuggestionId = null;
    this.toast.info('Metadata cleared');
    this.cdr.markForCheck();
  }

  onTraitSearchChange(value: string): void {
    this.traitSearch = value;
    this.cdr.markForCheck();
  }

  clearTraitSearch(): void {
    this.traitSearch = '';
    this.cdr.markForCheck();
  }

  onImageError(): void {
    this.imageLoadError = true;
    this.cdr.markForCheck();
  }

  trackByTrait(_: number, trait: NftTrait): string {
    return `${trait.traitType}:${trait.value}`;
  }

  private isFileDrag(event: DragEvent): boolean {
    return !!event.dataTransfer?.types.includes('Files');
  }
}

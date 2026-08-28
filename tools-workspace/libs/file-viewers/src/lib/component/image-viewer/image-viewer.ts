import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  IMAGE_ACCEPT_ATTR,
  IMAGE_DEFAULT_ZOOM,
  IMAGE_DOWNLOAD_STAGGER_MS,
  IMAGE_FIT_AFTER_FULLSCREEN_MS,
  IMAGE_FULLSCREEN_EVENTS,
  IMAGE_FULLSCREEN_RENDER_DELAY_MS,
  IMAGE_LIMITED_BROWSER_SUPPORT_MIME_TYPES,
  IMAGE_MAX_FILE_SIZE_BYTES,
  IMAGE_MAX_ZOOM,
  IMAGE_MIN_ZOOM,
  IMAGE_RELATED_TOOLS,
  IMAGE_SUPPORTED_MIME_TYPES,
  IMAGE_THUMBNAIL_SCROLL_AMOUNT,
  IMAGE_UNIVERSALLY_SUPPORTED_MIME_TYPES
} from '../../constants/image-viewer.constants';
import type { ImageFile } from '../../types/image-viewer.types';
import {
  computeFitZoomPercent,
  formatImageFileSize,
  formatImageMimeLabel,
  isFullscreenActive,
  isUniversallySupportedImageMime,
  normalizeImageMimeType,
  getMimeTypeFromExtension,
  resolveImageSuggestion,
  resolveNextImageIndexAfterRemoval,
  safeRevokeObjectUrl,
  stepImageZoom,
  validateImageFiles,
  verifyImageCanLoad
} from '../../utils/image-viewer.utils';

@Component({
  selector: 'lib-image-viewer',
  standalone: true,
  templateUrl: './image-viewer.html',
  styleUrls: ['./image-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class ImageViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imageContainer') imageContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('thumbnailsContainer') thumbnailsContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenContainer', { static: false }) fullscreenContainer!: ElementRef<HTMLDivElement>;

  readonly acceptAttr = IMAGE_ACCEPT_ATTR;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = IMAGE_RELATED_TOOLS;
  readonly minZoom = IMAGE_MIN_ZOOM;
  readonly maxZoom = IMAGE_MAX_ZOOM;

  readonly supportedFormats = IMAGE_SUPPORTED_MIME_TYPES;
  readonly universallySupportedFormats = IMAGE_UNIVERSALLY_SUPPORTED_MIME_TYPES;
  readonly limitedBrowserSupportFormats = IMAGE_LIMITED_BROWSER_SUPPORT_MIME_TYPES;
  readonly maxFileSize = IMAGE_MAX_FILE_SIZE_BYTES;

  images: ImageFile[] = [];
  currentImageIndex = -1;
  zoomLevel = IMAGE_DEFAULT_ZOOM;
  isDragging = false;
  dragStartX = 0;
  dragStartY = 0;
  imageOffsetX = 0;
  imageOffsetY = 0;
  isZoomed = false;
  thumbnailScrollLeft = 0;
  thumbnailScrollRight = false;
  isFullscreen = false;
  showDropZone = false;
  errorMessage = '';
  loading = false;
  dismissedSuggestionId: string | null = null;

  private isEnteringFullscreen = false;
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly fullscreenChangeHandler = () => this.onFullscreenChange();
  private readonly thumbnailScrollHandler = () => this.updateThumbnailScrollState();

  constructor(private readonly cdr: ChangeDetectorRef) {}

  get currentImage(): ImageFile | null {
    return this.currentImageIndex >= 0 && this.currentImageIndex < this.images.length
      ? this.images[this.currentImageIndex]
      : null;
  }

  get totalImageSize(): string {
    if (this.images.length === 0) {
      return '0 Bytes';
    }
    const totalBytes = this.images.reduce((sum, img) => sum + img.size, 0);
    return formatImageFileSize(totalBytes);
  }

  get currentFormatLabel(): string {
    return formatImageMimeLabel(this.currentImage?.type);
  }

  get canGoPrevious(): boolean {
    return this.images.length > 1 && this.currentImageIndex > 0;
  }

  get canGoNext(): boolean {
    return (
      this.images.length > 1 &&
      this.currentImageIndex >= 0 &&
      this.currentImageIndex < this.images.length - 1
    );
  }

  get activeIndexLabel(): string {
    if (this.images.length === 0 || this.currentImageIndex < 0) {
      return '—';
    }
    return `${this.currentImageIndex + 1}/${this.images.length}`;
  }

  get primarySuggestion() {
    const suggestion = resolveImageSuggestion({
      hasImages: this.images.length > 0,
      hasError: !!this.errorMessage,
      imageCount: this.images.length,
      currentMimeType: this.currentImage?.type || '',
      currentSize: this.currentImage?.size || 0
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  ngOnInit(): void {
    this.setupDragAndDrop();
    this.setupFullscreenListeners();
  }

  ngAfterViewInit(): void {
    if (this.thumbnailsContainer) {
      const container = this.thumbnailsContainer.nativeElement;
      container.addEventListener('scroll', this.thumbnailScrollHandler);
      this.updateThumbnailScrollState();
    }
  }

  ngOnDestroy(): void {
    for (const img of this.images) {
      safeRevokeObjectUrl(img.url);
    }

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }

    if (this.thumbnailsContainer?.nativeElement) {
      this.thumbnailsContainer.nativeElement.removeEventListener(
        'scroll',
        this.thumbnailScrollHandler
      );
    }

    for (const eventName of IMAGE_FULLSCREEN_EVENTS) {
      document.removeEventListener(eventName, this.fullscreenChangeHandler);
    }
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
    this.cdr.markForCheck();
  }

  setupFullscreenListeners(): void {
    if (typeof document === 'undefined') {
      return;
    }
    for (const eventName of IMAGE_FULLSCREEN_EVENTS) {
      document.addEventListener(eventName, this.fullscreenChangeHandler);
    }
  }

  setupDragAndDrop(): void {
    if (typeof document === 'undefined') {
      return;
    }
    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.addEventListener(eventName, this.preventDefaultsFn, false);
      document.body.addEventListener(eventName, this.preventDefaultsFn, false);
    }
  }

  preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  scrollThumbnails(direction: number): void {
    if (this.thumbnailsContainer) {
      const container = this.thumbnailsContainer.nativeElement;
      container.scrollBy({
        left: direction * IMAGE_THUMBNAIL_SCROLL_AMOUNT,
        behavior: 'smooth'
      });
      this.updateThumbnailScrollState();
    }
  }

  updateThumbnailScrollState(): void {
    if (this.thumbnailsContainer) {
      const container = this.thumbnailsContainer.nativeElement;
      this.thumbnailScrollLeft = container.scrollLeft;
      this.thumbnailScrollRight =
        container.scrollLeft < container.scrollWidth - container.clientWidth - 10;
    }
  }

  @HostListener('dragenter', ['$event'])
  onDragEnter(e: DragEvent): void {
    if (e.dataTransfer?.types.includes('Files')) {
      this.showDropZone = true;
    }
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(e: DragEvent): void {
    const currentTarget = e.currentTarget as HTMLElement | null;
    const relatedTarget = e.relatedTarget as Node | null;
    if (currentTarget && relatedTarget && !currentTarget.contains(relatedTarget)) {
      this.showDropZone = false;
    }
  }

  @HostListener('drop', ['$event'])
  onDrop(e: DragEvent): void {
    this.preventDefaults(e);
    this.showDropZone = false;
    const files = Array.from(e.dataTransfer?.files || []);
    this.processFiles(files);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.processFiles(Array.from(input.files));
    }
  }

  processFiles(files: File[]): void {
    this.errorMessage = '';
    this.loading = true;
    this.dismissedSuggestionId = null;

    const { validFiles, errors } = validateImageFiles(files, {
      supportedFormats: this.supportedFormats,
      maxFileSize: this.maxFileSize
    });

    if (errors.length > 0) {
      this.errorMessage = errors.join('\n');
    }

    let processedCount = 0;
    const totalFiles = validFiles.length;

    for (const file of validFiles) {
      const reader = new FileReader();
      const fileType = normalizeImageMimeType(
        file.type || getMimeTypeFromExtension(file.name),
        file.name
      );

      reader.onload = (e: ProgressEvent<FileReader>) => {
        const url = e.target?.result as string;
        const imageFile: ImageFile = {
          name: file.name,
          file,
          url,
          size: file.size,
          type: fileType
        };

        if (isUniversallySupportedImageMime(fileType)) {
          this.images.push(imageFile);
          if (this.currentImageIndex === -1) {
            this.currentImageIndex = this.images.length - 1;
          }
          processedCount++;
          if (processedCount === totalFiles) {
            this.loading = false;
            if (errors.length > 0) {
              this.errorMessage = errors.join('\n');
            }
          }
          this.updateThumbnailScrollState();
          setTimeout(() => {
            this.cdr.detectChanges();
          }, 0);
        } else {
          verifyImageCanLoad(url, imageFile, errors)
            .then(() => {
              this.images.push(imageFile);
              if (this.currentImageIndex === -1) {
                this.currentImageIndex = this.images.length - 1;
              }
              processedCount++;
              if (processedCount === totalFiles) {
                this.loading = false;
                if (errors.length > 0) {
                  this.errorMessage = errors.join('\n');
                }
              }
              this.updateThumbnailScrollState();
              setTimeout(() => {
                this.cdr.detectChanges();
              }, 0);
            })
            .catch(() => {
              errors.push(`${file.name}: Failed to load or unsupported format`);
              processedCount++;
              if (processedCount === totalFiles) {
                this.loading = false;
                this.errorMessage = errors.join('\n');
              }
            });
        }
      };

      reader.onerror = () => {
        errors.push(`Failed to read ${file.name}`);
        processedCount++;
        if (processedCount === totalFiles) {
          this.loading = false;
          this.errorMessage = errors.join('\n');
        }
      };

      reader.readAsDataURL(file);
    }

    if (validFiles.length === 0) {
      this.loading = false;
    }

    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  previousImage(): void {
    if (this.images.length === 0) {
      return;
    }

    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
      this.resetZoom();
    } else if (this.currentImageIndex === -1 && this.images.length > 0) {
      this.currentImageIndex = this.images.length - 1;
      this.resetZoom();
    }

    this.scrollThumbnailIntoView();
  }

  nextImage(): void {
    if (this.images.length === 0) {
      return;
    }

    if (this.currentImageIndex < this.images.length - 1) {
      this.currentImageIndex++;
      this.resetZoom();
    } else if (this.currentImageIndex === -1 && this.images.length > 0) {
      this.currentImageIndex = 0;
      this.resetZoom();
    }

    this.scrollThumbnailIntoView();
  }

  private scrollThumbnailIntoView(): void {
    if (this.thumbnailsContainer && this.currentImageIndex >= 0) {
      const container = this.thumbnailsContainer.nativeElement;
      const thumbnail = container.children[this.currentImageIndex] as HTMLElement;
      if (thumbnail) {
        thumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }

  removeImage(index: number): void {
    if (index < 0 || index >= this.images.length) {
      return;
    }

    if (this.images[index]?.url) {
      try {
        URL.revokeObjectURL(this.images[index].url);
      } catch {
        // Data URLs and invalid blobs are ignored
      }
    }

    const wasCurrentImage = index === this.currentImageIndex;
    this.images.splice(index, 1);

    if (wasCurrentImage) {
      this.currentImageIndex = resolveNextImageIndexAfterRemoval(
        index,
        index,
        this.images.length
      );
    } else if (index < this.currentImageIndex) {
      this.currentImageIndex--;
    }

    if (this.currentImageIndex >= this.images.length) {
      this.currentImageIndex = this.images.length > 0 ? this.images.length - 1 : -1;
    }

    if (this.currentImageIndex < 0 && this.images.length === 0) {
      this.currentImageIndex = -1;
    }

    this.resetZoom();
    this.updateThumbnailScrollState();
  }

  clearAll(): void {
    if (this.images.length === 0) {
      return;
    }

    for (const img of this.images) {
      safeRevokeObjectUrl(img.url);
    }

    this.images = [];
    this.currentImageIndex = -1;
    this.resetZoom();
    this.errorMessage = '';
    this.loading = false;
    this.dismissedSuggestionId = null;

    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  zoomIn(): void {
    if (this.zoomLevel < IMAGE_MAX_ZOOM) {
      this.zoomLevel = stepImageZoom(this.zoomLevel, 1);
      this.isZoomed = this.zoomLevel > 100;
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > IMAGE_MIN_ZOOM) {
      this.zoomLevel = stepImageZoom(this.zoomLevel, -1);
      this.isZoomed = this.zoomLevel > 100;
    }
  }

  resetZoom(): void {
    this.zoomLevel = IMAGE_DEFAULT_ZOOM;
    this.isZoomed = false;
    this.imageOffsetX = 0;
    this.imageOffsetY = 0;
  }

  fitToScreen(): void {
    if (!this.currentImage) {
      return;
    }

    const container = this.isFullscreen
      ? this.fullscreenContainer?.nativeElement
      : this.imageContainer?.nativeElement;

    if (!container) {
      this.resetZoom();
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const availableWidth = containerRect.width - 40;
    const availableHeight = containerRect.height - 40;

    const img = new Image();
    img.src = this.currentImage.url;

    img.onload = () => {
      this.zoomLevel = computeFitZoomPercent(
        img.width,
        img.height,
        availableWidth,
        availableHeight
      );
      this.isZoomed = this.zoomLevel > 100;
      this.imageOffsetX = 0;
      this.imageOffsetY = 0;
      this.cdr.detectChanges();
    };

    img.onerror = () => {
      this.resetZoom();
    };
  }

  enterFullscreen(): void {
    if (!this.currentImage) {
      return;
    }

    if (this.isEnteringFullscreen || this.isFullscreen) {
      return;
    }

    this.isEnteringFullscreen = true;
    this.isFullscreen = true;
    this.cdr.detectChanges();

    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = this.fullscreenContainer?.nativeElement;
        if (!container) {
          this.isFullscreen = false;
          this.isEnteringFullscreen = false;
          this.cdr.detectChanges();
          return;
        }

        const extended = container as HTMLElement & {
          webkitRequestFullscreen?: () => void;
          mozRequestFullScreen?: () => void;
          msRequestFullscreen?: () => void;
        };

        try {
          if (container.requestFullscreen) {
            container
              .requestFullscreen()
              .then(() => {
                this.isEnteringFullscreen = false;
                setTimeout(() => {
                  this.fitToScreen();
                }, IMAGE_FIT_AFTER_FULLSCREEN_MS);
              })
              .catch(() => {
                this.isFullscreen = false;
                this.isEnteringFullscreen = false;
                this.cdr.detectChanges();
              });
          } else if (extended.webkitRequestFullscreen) {
            extended.webkitRequestFullscreen();
            this.isEnteringFullscreen = false;
            setTimeout(() => {
              this.fitToScreen();
            }, IMAGE_FIT_AFTER_FULLSCREEN_MS);
          } else if (extended.mozRequestFullScreen) {
            extended.mozRequestFullScreen();
            this.isEnteringFullscreen = false;
            setTimeout(() => {
              this.fitToScreen();
            }, IMAGE_FIT_AFTER_FULLSCREEN_MS);
          } else if (extended.msRequestFullscreen) {
            extended.msRequestFullscreen();
            this.isEnteringFullscreen = false;
            setTimeout(() => {
              this.fitToScreen();
            }, IMAGE_FIT_AFTER_FULLSCREEN_MS);
          } else {
            container.classList.add('iv-fullscreen--active');
            this.isEnteringFullscreen = false;
            setTimeout(() => {
              this.fitToScreen();
            }, IMAGE_FIT_AFTER_FULLSCREEN_MS);
          }
        } catch {
          this.isFullscreen = false;
          this.isEnteringFullscreen = false;
          this.cdr.detectChanges();
        }
      }, IMAGE_FULLSCREEN_RENDER_DELAY_MS);
    });
  }

  exitFullscreen(): void {
    this.isEnteringFullscreen = false;
    this.isFullscreen = false;

    const extended = document as Document & {
      webkitExitFullscreen?: () => void;
      mozCancelFullScreen?: () => void;
      msExitFullscreen?: () => void;
    };

    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => undefined);
    } else if (extended.webkitExitFullscreen) {
      extended.webkitExitFullscreen();
    } else if (extended.mozCancelFullScreen) {
      extended.mozCancelFullScreen();
    } else if (extended.msExitFullscreen) {
      extended.msExitFullscreen();
    }

    if (this.fullscreenContainer?.nativeElement) {
      this.fullscreenContainer.nativeElement.classList.remove('iv-fullscreen--active');
    }

    this.cdr.detectChanges();
  }

  onImageMouseDown(e: MouseEvent): void {
    if (this.isZoomed) {
      this.isDragging = true;
      this.dragStartX = e.clientX - this.imageOffsetX;
      this.dragStartY = e.clientY - this.imageOffsetY;
      e.preventDefault();
    }
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    if (this.isDragging && this.isZoomed) {
      this.imageOffsetX = e.clientX - this.dragStartX;
      this.imageOffsetY = e.clientY - this.dragStartY;
    }
  }

  @HostListener('mouseup')
  onMouseUp(): void {
    this.isDragging = false;
  }

  @HostListener('wheel', ['$event'])
  onWheel(e: WheelEvent): void {
    if (this.currentImage) {
      const container = this.imageContainer?.nativeElement;
      const fullscreenContainer = this.fullscreenContainer?.nativeElement;
      const target = e.target;

      const isInContainer = container && target && container.contains(target as Node);
      const isInFullscreen =
        fullscreenContainer && target && fullscreenContainer.contains(target as Node);

      if (isInContainer || isInFullscreen) {
        e.preventDefault();
        if (e.deltaY < 0) {
          this.zoomIn();
        } else {
          this.zoomOut();
        }
      }
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.isFullscreen) {
      this.exitFullscreen();
      return;
    }

    const target = e.target as HTMLElement;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return;
    }

    if (this.images.length > 0) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.previousImage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.nextImage();
      }
    }
  }

  onFullscreenChange(): void {
    const isCurrentlyFullscreen = isFullscreenActive();

    if (!isCurrentlyFullscreen && this.isFullscreen) {
      this.isEnteringFullscreen = false;
      this.isFullscreen = false;
      this.resetZoom();
      this.cdr.detectChanges();
    } else if (isCurrentlyFullscreen && this.isFullscreen) {
      this.isEnteringFullscreen = false;
      setTimeout(() => {
        this.fitToScreen();
      }, IMAGE_FIT_AFTER_FULLSCREEN_MS);
    }
  }

  downloadImage(): void {
    if (!this.currentImage) {
      return;
    }

    const link = document.createElement('a');
    link.href = this.currentImage.url;
    link.download = this.currentImage.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    this.toast.info(`Downloaded ${this.currentImage.name}`);
  }

  downloadAll(): void {
    for (let index = 0; index < this.images.length; index++) {
      const img = this.images[index];
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = img.url;
        link.download = img.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * IMAGE_DOWNLOAD_STAGGER_MS);
    }
    if (this.images.length > 0) {
      this.toast.info(`Downloading ${this.images.length} images`);
    }
  }

  formatFileSize(bytes: number): string {
    return formatImageFileSize(bytes);
  }

  selectImage(index: number): void {
    if (index < 0 || index >= this.images.length) {
      return;
    }

    this.currentImageIndex = index;
    this.resetZoom();

    if (this.thumbnailsContainer) {
      const container = this.thumbnailsContainer.nativeElement;
      const thumbnail = container.children[index] as HTMLElement;
      if (thumbnail) {
        thumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }
}

import { Component, OnInit, OnDestroy, AfterViewInit, HostListener, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

interface ImageFile {
  name: string;
  file: File;
  url: string;
  size: number;
  type: string;
}

@Component({
  selector: 'lib-image-viewer',
  standalone: true,
  templateUrl: './image-viewer.html',
  styleUrls: ['./image-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class ImageViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imageContainer') imageContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('thumbnailsContainer') thumbnailsContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenContainer', { static: false }) fullscreenContainer!: ElementRef<HTMLDivElement>;
  
  images: ImageFile[] = [];
  currentImageIndex: number = -1;
  zoomLevel: number = 100;
  isDragging: boolean = false;
  dragStartX: number = 0;
  dragStartY: number = 0;
  imageOffsetX: number = 0;
  imageOffsetY: number = 0;
  isZoomed: boolean = false;
  thumbnailScrollLeft: number = 0;
  thumbnailScrollRight: boolean = false;
  isFullscreen: boolean = false;
  private isEnteringFullscreen: boolean = false;
  
  // Supported formats - comprehensive list of image formats
  readonly supportedFormats = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/bmp',
    'image/webp',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'image/ico',
    'image/avif',
    'image/apng',
    'image/x-png',
    'image/x-jpeg',
    'image/x-bmp',
    'image/x-windows-bmp',
    'image/x-ms-bmp',
    'image/vnd.adobe.photoshop',
    'image/x-portable-pixmap',
    'image/x-portable-graymap',
    'image/x-portable-bitmap',
    'image/x-xpixmap',
    'image/x-xbitmap'
  ];
  
  // Formats that are universally supported - skip verification
  readonly universallySupportedFormats = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp'
  ];
  
  // Formats that might have limited browser support - will verify
  readonly limitedBrowserSupportFormats: string[] = [];
  
  readonly maxFileSize = 50 * 1024 * 1024; // 50MB
  
  // UI states
  showDropZone: boolean = false;
  errorMessage: string = '';
  loading: boolean = false;
  
  // Store preventDefaults function reference for cleanup
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  // Store fullscreen change handler reference for cleanup
  private readonly fullscreenChangeHandler = () => this.onFullscreenChange();

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.setupDragAndDrop();
    this.setupFullscreenListeners();
  }

  setupFullscreenListeners(): void {
    // Listen to all fullscreen change events
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    for (const eventName of events) {
      document.addEventListener(eventName, this.fullscreenChangeHandler);
    }
  }

  setupDragAndDrop(): void {
    // Prevent default drag behaviors on the document
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
      const scrollAmount = 300;
      container.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
      });
      this.updateThumbnailScrollState();
    }
  }
  
  updateThumbnailScrollState(): void {
    if (this.thumbnailsContainer) {
      const container = this.thumbnailsContainer.nativeElement;
      this.thumbnailScrollLeft = container.scrollLeft;
      this.thumbnailScrollRight = container.scrollLeft < (container.scrollWidth - container.clientWidth - 10);
    }
  }
  
  ngAfterViewInit(): void {
    if (this.thumbnailsContainer) {
      const container = this.thumbnailsContainer.nativeElement;
      container.addEventListener('scroll', () => this.updateThumbnailScrollState());
      this.updateThumbnailScrollState();
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
      const files = Array.from(input.files);
      this.processFiles(files);
    }
  }

  processFiles(files: File[]): void {
    this.errorMessage = '';
    this.loading = true;
    
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      // Check file type - also check by extension if MIME type is not recognized
      const fileType = file.type || this.getMimeTypeFromExtension(file.name);
      const normalizedType = this.normalizeMimeType(fileType, file.name);
      
      if (!this.supportedFormats.includes(normalizedType) && !this.isImageFile(file.name)) {
        errors.push(`${file.name}: Unsupported format. Please use standard image formats (PNG, JPEG, GIF, BMP, SVG, WEBP, ICO, AVIF, etc.)`);
        continue;
      }

      // Check file size
      if (file.size > this.maxFileSize) {
        errors.push(`${file.name}: File size exceeds 50MB limit`);
        continue;
      }

      // Warn about limited browser support formats
      if (this.limitedBrowserSupportFormats.includes(normalizedType)) {
        console.warn(`${file.name} uses format ${normalizedType} which may have limited browser support`);
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      this.errorMessage = errors.join('\n');
    }

    // Process valid files
    let processedCount = 0;
    const totalFiles = validFiles.length;
    
    for (const file of validFiles) {
      const reader = new FileReader();
      const fileType = this.normalizeMimeType(file.type || this.getMimeTypeFromExtension(file.name), file.name);
      
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const url = e.target?.result as string;
        const imageFile: ImageFile = {
          name: file.name,
          file: file,
          url: url,
          size: file.size,
          type: fileType
        };
        
        // For universally supported formats, skip verification and add directly
        // Only verify formats that might have browser compatibility issues
        if (this.universallySupportedFormats.includes(fileType)) {
          // Common formats - trust the browser can handle them
          this.images.push(imageFile);
          
          // Set first image as current if none selected
          // Use the actual index of the newly added image
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
          
          // Trigger change detection to update the view immediately
          setTimeout(() => {
            this.cdr.detectChanges();
          }, 0);
        } else {
          // Verify image can be loaded for formats that might have compatibility issues
          this.verifyImageLoad(url, imageFile, errors).then(() => {
            this.images.push(imageFile);
            
            // Set first image as current if none selected
            // Use the actual index of the newly added image
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
            // Trigger change detection to update the view immediately
            setTimeout(() => {
              this.cdr.detectChanges();
            }, 0);
          }).catch(() => {
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

    // Reset file input
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

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
    return this.formatFileSize(totalBytes);
  }

  previousImage(): void {
    if (this.images.length === 0) return;
    
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
      this.resetZoom();
    } else if (this.currentImageIndex === -1 && this.images.length > 0) {
      // If no image selected, select the last one
      this.currentImageIndex = this.images.length - 1;
      this.resetZoom();
    }
    
    // Scroll thumbnail into view
    this.scrollThumbnailIntoView();
  }

  nextImage(): void {
    if (this.images.length === 0) return;
    
    if (this.currentImageIndex < this.images.length - 1) {
      this.currentImageIndex++;
      this.resetZoom();
    } else if (this.currentImageIndex === -1 && this.images.length > 0) {
      // If no image selected, select the first one
      this.currentImageIndex = 0;
      this.resetZoom();
    }
    
    // Scroll thumbnail into view
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
    // Edge case: invalid index
    if (index < 0 || index >= this.images.length) {
      return;
    }
    
    // Revoke object URL to free memory
    if (this.images[index]?.url) {
      URL.revokeObjectURL(this.images[index].url);
    }
    
    const wasCurrentImage = index === this.currentImageIndex;
    this.images.splice(index, 1);
    
    // Adjust current index
    if (wasCurrentImage) {
      // If we removed the current image, select the previous one or next one
      if (this.images.length > 0) {
        if (index > 0) {
          this.currentImageIndex = index - 1;
        } else if (index < this.images.length) {
          this.currentImageIndex = index;
        } else {
          this.currentImageIndex = this.images.length - 1;
        }
      } else {
        this.currentImageIndex = -1;
      }
    } else if (index < this.currentImageIndex) {
      // If we removed an image before the current one, adjust index
      this.currentImageIndex--;
    }
    
    // Ensure index is valid
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
    // Edge case: nothing to clear
    if (this.images.length === 0) {
      return;
    }
    
    // Revoke all object URLs to free memory
    for (const img of this.images) {
      if (img.url?.startsWith('blob:')) {
        URL.revokeObjectURL(img.url);
      }
    }
    
    this.images = [];
    this.currentImageIndex = -1;
    this.resetZoom();
    this.errorMessage = '';
    this.loading = false;
    
    // Reset file input
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  zoomIn(): void {
    if (this.zoomLevel < 500) {
      this.zoomLevel = Math.min(this.zoomLevel + 25, 500);
      this.isZoomed = this.zoomLevel > 100;
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > 25) {
      this.zoomLevel = Math.max(this.zoomLevel - 25, 25);
      this.isZoomed = this.zoomLevel > 100;
    }
  }

  resetZoom(): void {
    this.zoomLevel = 100;
    this.isZoomed = false;
    this.imageOffsetX = 0;
    this.imageOffsetY = 0;
  }

  fitToScreen(): void {
    if (!this.currentImage) {
      return;
    }

    // Get the container dimensions
    const container = this.isFullscreen 
      ? this.fullscreenContainer?.nativeElement 
      : this.imageContainer?.nativeElement;
    
    if (!container) {
      this.resetZoom();
      return;
    }

    // Get available space (accounting for padding/margins)
    const containerRect = container.getBoundingClientRect();
    const availableWidth = containerRect.width - 40; // Account for padding
    const availableHeight = containerRect.height - 40;

    // Create a temporary image to get natural dimensions
    const img = new Image();
    img.src = this.currentImage.url;
    
    img.onload = () => {
      const naturalWidth = img.width;
      const naturalHeight = img.height;

      // Calculate zoom to fit both width and height
      const widthRatio = availableWidth / naturalWidth;
      const heightRatio = availableHeight / naturalHeight;
      const fitRatio = Math.min(widthRatio, heightRatio, 1); // Don't zoom in beyond 100%

      // Set zoom level (convert ratio to percentage)
      this.zoomLevel = Math.max(25, Math.min(100, Math.round(fitRatio * 100)));
      this.isZoomed = this.zoomLevel > 100;
      this.imageOffsetX = 0;
      this.imageOffsetY = 0;
      this.cdr.detectChanges();
    };

    img.onerror = () => {
      // Fallback to reset if image fails to load
      this.resetZoom();
    };
  }

  enterFullscreen(): void {
    // Edge case: no image to show
    if (!this.currentImage) {
      return;
    }

    // Prevent multiple simultaneous requests
    if (this.isEnteringFullscreen || this.isFullscreen) {
      return;
    }

    this.isEnteringFullscreen = true;

    // Set fullscreen state first to render the container
    this.isFullscreen = true;
    this.cdr.detectChanges();

    // Wait for Angular to render the DOM element
    // Use requestAnimationFrame for better timing
    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = this.fullscreenContainer?.nativeElement;
        if (!container) {
          console.warn('Fullscreen container not found after render');
          this.isFullscreen = false;
          this.isEnteringFullscreen = false;
          this.cdr.detectChanges();
          return;
        }

        // Request fullscreen with error handling
        try {
          if (container.requestFullscreen) {
            container.requestFullscreen().then(() => {
              this.isEnteringFullscreen = false;
              // Fit image to screen when entering fullscreen
              setTimeout(() => {
                this.fitToScreen();
              }, 150);
            }).catch(err => {
              console.error('Error attempting to enable fullscreen:', err);
              this.isFullscreen = false;
              this.isEnteringFullscreen = false;
              this.cdr.detectChanges();
            });
          } else if ((container as any).webkitRequestFullscreen) {
            (container as any).webkitRequestFullscreen();
            this.isEnteringFullscreen = false;
            setTimeout(() => {
              this.fitToScreen();
            }, 150);
          } else if ((container as any).mozRequestFullScreen) {
            (container as any).mozRequestFullScreen();
            this.isEnteringFullscreen = false;
            setTimeout(() => {
              this.fitToScreen();
            }, 150);
          } else if ((container as any).msRequestFullscreen) {
            (container as any).msRequestFullscreen();
            this.isEnteringFullscreen = false;
            setTimeout(() => {
              this.fitToScreen();
            }, 150);
          } else {
            // Fallback: use fullscreen CSS class (container is already rendered)
            container.classList.add('fullscreen-active');
            this.isEnteringFullscreen = false;
            setTimeout(() => {
              this.fitToScreen();
            }, 150);
          }
        } catch (err) {
          console.error('Error entering fullscreen:', err);
          this.isFullscreen = false;
          this.isEnteringFullscreen = false;
          this.cdr.detectChanges();
        }
      }, 100); // Give Angular time to render
    });
  }

  exitFullscreen(): void {
    this.isEnteringFullscreen = false;
    this.isFullscreen = false;
    
    // Exit fullscreen API
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(err => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }
    
    // Remove fallback fullscreen class
    if (this.fullscreenContainer?.nativeElement) {
      this.fullscreenContainer.nativeElement.classList.remove('fullscreen-active');
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
      // Check if wheel is in image container or fullscreen
      const container = this.imageContainer?.nativeElement;
      const fullscreenContainer = this.fullscreenContainer?.nativeElement;
      const target = e.target;
      
      const isInContainer = container && target && container.contains(target as Node);
      const isInFullscreen = fullscreenContainer && target && fullscreenContainer.contains(target as Node);
      
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
    // Exit fullscreen on Escape key
    if (e.key === 'Escape' && this.isFullscreen) {
      this.exitFullscreen();
      return;
    }
    
    // Don't handle keyboard shortcuts if user is typing in an input
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    
    // Keyboard navigation for images
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
    // Check if we're actually in fullscreen
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
    
    if (!isCurrentlyFullscreen && this.isFullscreen) {
      // User exited fullscreen externally (e.g., F11 key, Escape)
      this.isEnteringFullscreen = false;
      this.isFullscreen = false;
      // Reset zoom when exiting fullscreen
      this.resetZoom();
      this.cdr.detectChanges();
    } else if (isCurrentlyFullscreen && this.isFullscreen) {
      // Just entered fullscreen, fit image to screen
      this.isEnteringFullscreen = false;
      setTimeout(() => {
        this.fitToScreen();
      }, 150);
    }
  }

  downloadImage(): void {
    if (!this.currentImage) return;
    
    const link = document.createElement('a');
    link.href = this.currentImage.url;
    link.download = this.currentImage.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
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
      }, index * 100);
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  selectImage(index: number): void {
    // Edge case: invalid index
    if (index < 0 || index >= this.images.length) {
      return;
    }
    
    this.currentImageIndex = index;
    this.resetZoom();
    
    // Scroll thumbnail into view if needed
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

  // Get MIME type from file extension
  private getMimeTypeFromExtension(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: { [key: string]: string } = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'avif': 'image/avif',
      'apng': 'image/apng',
      'psd': 'image/vnd.adobe.photoshop',
      'ppm': 'image/x-portable-pixmap',
      'pgm': 'image/x-portable-graymap',
      'pbm': 'image/x-portable-bitmap',
      'xpm': 'image/x-xpixmap',
      'xbm': 'image/x-xbitmap'
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  // Normalize MIME type for better compatibility
  private normalizeMimeType(mimeType: string, filename: string): string {
    // Handle common variations
    if (mimeType === 'image/jpg') return 'image/jpeg';
    if (mimeType === 'image/ico' || mimeType === 'image/vnd.microsoft.icon') return 'image/x-icon';
    if (mimeType === 'image/x-png') return 'image/png';
    if (mimeType === 'image/x-jpeg') return 'image/jpeg';
    if (mimeType === 'image/x-bmp' || mimeType === 'image/x-windows-bmp' || mimeType === 'image/x-ms-bmp') return 'image/bmp';
    
    // If no MIME type, try to infer from extension
    if (!mimeType || mimeType === 'application/octet-stream') {
      return this.getMimeTypeFromExtension(filename);
    }
    
    return mimeType;
  }

  // Check if file is likely an image based on extension
  private isImageFile(filename: string): boolean {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico', 'avif', 'apng', 'psd', 'ppm', 'pgm', 'pbm', 'xpm', 'xbm'];
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    return imageExtensions.includes(extension);
  }

  // Verify image can actually be loaded
  private verifyImageLoad(url: string, imageFile: ImageFile, errors: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let timeoutId: number | null = null;
      let isResolved = false;
      
      const cleanup = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      };
      
      img.onload = () => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve();
        }
      };
      
      img.onerror = () => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          // Some formats might not be supported by the browser
          // Try to provide helpful error message
          if (this.limitedBrowserSupportFormats.includes(imageFile.type)) {
            errors.push(`${imageFile.name}: Format ${imageFile.type} may not be supported by your browser. Try converting to PNG or JPEG.`);
          }
          reject(new Error(`Failed to load image: ${imageFile.name}`));
        }
      };
      
      img.src = url;
      
      // Timeout after 10 seconds only if image hasn't loaded
      timeoutId = globalThis.setTimeout(() => {
        if (!isResolved && !img.complete) {
          isResolved = true;
          cleanup();
          reject(new Error(`Image load timeout: ${imageFile.name}`));
        }
      }, 10000);
    });
  }

  ngOnDestroy(): void {
    // Clean up object URLs
    for (const img of this.images) {
      if (img.url?.startsWith('blob:')) {
        URL.revokeObjectURL(img.url);
      }
    }
    
    // Remove event listeners
    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }
    
    // Remove thumbnail scroll listener
    if (this.thumbnailsContainer?.nativeElement) {
      const container = this.thumbnailsContainer.nativeElement;
      const scrollHandler = () => this.updateThumbnailScrollState();
      container.removeEventListener('scroll', scrollHandler);
    }
    
    // Remove fullscreen listeners
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    for (const eventName of events) {
      document.removeEventListener(eventName, this.fullscreenChangeHandler);
    }
  }
}

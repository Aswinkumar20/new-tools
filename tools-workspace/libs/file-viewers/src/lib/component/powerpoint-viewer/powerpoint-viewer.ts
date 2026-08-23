import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

// JSZip types for PPTX extraction (PPTX files are ZIP archives)
declare const JSZip: {
  new (): {
    loadAsync(data: ArrayBuffer): Promise<any>;
  };
};

interface JSZipObject {
  async(type: string): Promise<any>;
}

// Load JSZip dynamically from CDN
async function loadJSZip(): Promise<typeof JSZip> {
  if (globalThis.window === undefined) {
    throw new TypeError('JSZip can only be loaded in browser environment');
  }

  if ((globalThis as any).JSZip) {
    return (globalThis as any).JSZip;
  }

  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    script.onload = () => {
      const JSZipLib = (globalThis as any).JSZip;
      (globalThis as any).JSZip = JSZipLib;
      resolve(JSZipLib);
    };
    script.onerror = () => reject(new Error('Failed to load JSZip library'));
  });
}

// File type detection
enum PresentationType {
  PPTX = 'pptx',
  PPT = 'ppt',
  ODP = 'odp',
  UNSUPPORTED = 'unsupported'
}

function detectPresentationType(file: File): PresentationType {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (fileName.endsWith('.pptx') || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return PresentationType.PPTX;
  }
  if (fileName.endsWith('.ppt') || mimeType === 'application/vnd.ms-powerpoint') {
    return PresentationType.PPT;
  }
  if (fileName.endsWith('.odp') || mimeType === 'application/vnd.oasis.opendocument.presentation') {
    return PresentationType.ODP;
  }

  return PresentationType.UNSUPPORTED;
}

interface Slide {
  number: number;
  htmlContent: string;
  textContent: string;
}

interface PowerpointFile {
  name: string;
  file: File;
  url: string;
  size: number;
  slides: Slide[];
  totalSlides: number;
  presentationType: PresentationType;
  needsPassword: boolean;
  passwordError: boolean;
}

@Component({
  selector: 'lib-powerpoint-viewer',
  standalone: true,
  templateUrl: './powerpoint-viewer.html',
  styleUrls: ['./powerpoint-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class PowerpointViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('slideContainer') slideContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenContainer') fullscreenContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenSlideContainer') fullscreenSlideContainer!: ElementRef<HTMLDivElement>;

  powerpointFiles: PowerpointFile[] = [];
  currentFileIndex: number = -1;
  currentSlide: number = 1;
  loading: boolean = false;
  errorMessage: string = '';
  showDropZone: boolean = false;
  isFullscreen: boolean = false;
  zoomLevel: number = 100;

  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly fullscreenChangeHandler = () => this.onFullscreenChange();

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.setupDragAndDrop();
    this.setupFullscreenListeners();
  }

  ngAfterViewInit(): void {
    // Load JSZip library
    loadJSZip().catch(err => {
      console.error('Failed to load JSZip:', err);
      this.errorMessage = 'Failed to load PowerPoint viewer library. Please refresh the page.';
    });
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.isFullscreen) {
      this.exitFullscreen();
    } else if (e.key === 'ArrowLeft' && this.currentPresentation) {
      this.previousSlide();
    } else if (e.key === 'ArrowRight' && this.currentPresentation) {
      this.nextSlide();
    }
  }

  get currentPresentation(): PowerpointFile | null {
    return this.currentFileIndex >= 0 && this.currentFileIndex < this.powerpointFiles.length
      ? this.powerpointFiles[this.currentFileIndex]
      : null;
  }

  get loadedPresentationsCount(): number {
    return this.powerpointFiles.length;
  }

  get currentSlideSummary(): string {
    const total = this.currentPresentation?.totalSlides ?? 0;
    if (!total) {
      return '0 / 0';
    }
    const current = Math.min(this.currentSlide, total);
    return `${current} / ${total}`;
  }

  get totalPresentationsSize(): string {
    if (!this.powerpointFiles.length) {
      return '0 Bytes';
    }
    const totalBytes = this.powerpointFiles.reduce((sum, file) => sum + file.size, 0);
    return this.formatFileSize(totalBytes);
  }

  setupDragAndDrop(): void {
    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.addEventListener(eventName, this.preventDefaultsFn, false);
      document.body.addEventListener(eventName, this.preventDefaultsFn, false);
    }
  }

  preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  onDragEnter(): void {
    this.showDropZone = true;
  }

  onDragLeave(): void {
    this.showDropZone = false;
  }

  onDrop(e: DragEvent): void {
    this.showDropZone = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFiles(Array.from(files));
    }
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFiles(Array.from(input.files));
    }
  }

  async processFiles(files: File[]): Promise<void> {
    this.errorMessage = '';
    this.loading = true;

    let JSZipLib: typeof JSZip;
    try {
      JSZipLib = await loadJSZip();
    } catch (error: unknown) {
      this.loading = false;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.errorMessage = `Failed to load PowerPoint viewer library: ${message}. Please refresh the page.`;
      console.error('JSZip load error:', error);
      return;
    }

    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const presType = detectPresentationType(file);

      if (presType === PresentationType.UNSUPPORTED) {
        errors.push(`${file.name}: Unsupported file format. Supported: PPTX, PPT, ODP`);
        continue;
      }

      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        errors.push(`${file.name}: File too large (max 100MB)`);
        continue;
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      this.errorMessage = errors.join('\n');
    }

    for (const file of validFiles) {
      try {
        const url = URL.createObjectURL(file);
        const presType = detectPresentationType(file);

        let slides: Slide[] = [];
        let totalSlides = 0;

        switch (presType) {
          case PresentationType.PPTX: {
            const arrayBuffer = await file.arrayBuffer();
            slides = await this.extractPptxSlides(arrayBuffer, JSZipLib);
            totalSlides = slides.length;
            break;
          }

          case PresentationType.PPT: {
            slides = [{
              number: 1,
              htmlContent: `<div class="ppt-content">
                <div style="padding: 2rem; text-align: center; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin: 2rem 0;">
                  <h3 style="color: #856404; margin-bottom: 1rem;">Legacy PPT Format</h3>
                  <p style="color: #856404; margin-bottom: 1rem;">
                    This is a legacy .ppt file format. For best viewing experience, please convert it to .pptx format.
                  </p>
                  <p style="color: #856404; font-size: 0.9rem;">
                    The .ppt format is a binary format that requires special libraries to parse.
                    For full support, please convert your .ppt file to .pptx format using Microsoft PowerPoint or an online converter.
                  </p>
                </div>
              </div>`,
              textContent: 'Legacy PPT format - conversion to PPTX recommended for full support'
            }];
            totalSlides = 1;
            break;
          }

          case PresentationType.ODP: {
            slides = [{
              number: 1,
              htmlContent: `<div class="odp-content">
                <div style="padding: 2rem; text-align: center; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin: 2rem 0;">
                  <h3 style="color: #856404; margin-bottom: 1rem;">ODP Format</h3>
                  <p style="color: #856404;">
                    ODP (OpenDocument Presentation) files require conversion. Please convert to PPTX format for better support.
                  </p>
                </div>
              </div>`,
              textContent: 'ODP file content extraction not fully supported. Please convert to PPTX.'
            }];
            totalSlides = 1;
            break;
          }
        }

        const powerpointFile: PowerpointFile = {
          name: file.name,
          file: file,
          url: url,
          size: file.size,
          slides: slides,
          totalSlides: totalSlides,
          presentationType: presType,
          needsPassword: false,
          passwordError: false
        };

        this.powerpointFiles.push(powerpointFile);

        // Wait for Angular to update the view
        this.cdr.detectChanges();

        if (this.currentFileIndex === -1 && powerpointFile.totalSlides > 0) {
          this.currentFileIndex = this.powerpointFiles.length - 1;
          // Wait for Angular to render the view before loading
          requestAnimationFrame(() => {
            setTimeout(() => {
              this.loadPresentation(powerpointFile);
            }, 50);
          });
        }
      } catch (error) {
        errors.push(`${file.name}: Failed to load presentation - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    this.loading = false;
    if (errors.length > 0) {
      this.errorMessage = errors.join('\n');
    }

    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  async extractPptxSlides(arrayBuffer: ArrayBuffer, JSZipLib: typeof JSZip): Promise<Slide[]> {
    try {
      const zip = new JSZipLib();
      const zipContent = await zip.loadAsync(arrayBuffer);

      // Extract slides from ppt/slides/ directory
      const slides: Slide[] = [];
      let slideIndex = 1;

      // PPTX structure: ppt/slides/slide1.xml, slide2.xml, etc.
      for (const fileName of Object.keys(zipContent.files)) {
        if (fileName.match(/^ppt\/slides\/slide\d+\.xml$/)) {
          try {
            const slideXml = await zipContent.files[fileName].async('string');
            const htmlContent = await this.convertSlideXmlToHtml(slideXml, zipContent);
            const textContent = this.extractTextFromXml(slideXml);

            slides.push({
              number: slideIndex++,
              htmlContent: htmlContent,
              textContent: textContent
            });
          } catch (error) {
            console.warn(`Failed to extract slide ${fileName}:`, error);
          }
        }
      }

      // If no slides found, create a placeholder
      if (slides.length === 0) {
        slides.push({
          number: 1,
          htmlContent: '<div class="slide-content"><p>Unable to extract slide content. The file may be corrupted or use unsupported features.</p></div>',
          textContent: 'Unable to extract slide content'
        });
      }

      return slides;
    } catch (error) {
      throw new Error(`Failed to extract PPTX content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async convertSlideXmlToHtml(slideXml: string, zipContent: any): Promise<string> {
    // Basic XML parsing and HTML conversion
    // This is a simplified version - full PPTX parsing would require more complex logic
    
    let html = '<div class="slide-content">';
    
    // Extract text from XML (simplified)
    const textMatch = slideXml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
    if (textMatch) {
      const texts = textMatch.map(m => {
        const content = m.match(/<a:t[^>]*>([^<]*)<\/a:t>/);
        return content ? content[1] : '';
      }).filter(t => t.trim());

      if (texts.length > 0) {
        html += '<div class="slide-text">';
        texts.forEach((text, index) => {
          // Check if it's a heading (simplified detection)
          if (index === 0 || text.length < 50) {
            html += `<h2>${this.escapeHtml(text)}</h2>`;
          } else {
            html += `<p>${this.escapeHtml(text)}</p>`;
          }
        });
        html += '</div>';
      }
    }

    // Extract images if any
    const imageMatch = slideXml.match(/<a:blip[^>]*r:embed="([^"]+)"/g);
    if (imageMatch) {
      html += '<div class="slide-images">';
      for (const imgRef of imageMatch) {
        const embedId = imgRef.match(/r:embed="([^"]+)"/);
        if (embedId) {
          try {
            const imagePath = `ppt/media/${embedId[1]}`;
            // Try to find image in zip
            for (const fileName of Object.keys(zipContent.files)) {
              if (fileName.includes(embedId[1])) {
                const imageBlob = await zipContent.files[fileName].async('blob');
                const imageUrl = URL.createObjectURL(imageBlob);
                html += `<img src="${imageUrl}" alt="Slide image" style="max-width: 100%; height: auto; margin: 1rem 0;" />`;
                break;
              }
            }
          } catch (error) {
            console.warn('Failed to extract image:', error);
          }
        }
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  extractTextFromXml(xml: string): string {
    const textMatch = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
    if (textMatch) {
      return textMatch.map(m => {
        const content = m.match(/<a:t[^>]*>([^<]*)<\/a:t>/);
        return content ? content[1] : '';
      }).filter(t => t.trim()).join(' ');
    }
    return '';
  }

  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async loadPresentation(powerpointFile: PowerpointFile): Promise<void> {
    if (!powerpointFile || powerpointFile.slides.length === 0) {
      this.errorMessage = 'Presentation content not available';
      this.cdr.detectChanges();
      return;
    }

    this.currentSlide = 1;
    this.cdr.detectChanges();

    await new Promise(resolve => setTimeout(resolve, 100));

    const getContainer = (): HTMLDivElement | null => {
      if (this.isFullscreen && this.fullscreenSlideContainer?.nativeElement) {
        return this.fullscreenSlideContainer.nativeElement;
      }
      if (this.slideContainer?.nativeElement) {
        return this.slideContainer.nativeElement;
      }
      return document.querySelector('.slide-content-wrapper') as HTMLDivElement;
    };

    let attempts = 0;
    const maxAttempts = 20;

    const tryRender = (): void => {
      attempts++;
      const container = getContainer();

      if (container && powerpointFile.slides.length > 0) {
        const currentSlideData = powerpointFile.slides[this.currentSlide - 1];
        if (currentSlideData) {
          container.innerHTML = currentSlideData.htmlContent || '';
          container.style.zoom = `${this.zoomLevel}%`;
        }
        this.cdr.detectChanges();
        return;
      }

      if (attempts < maxAttempts) {
        this.cdr.detectChanges();
        setTimeout(tryRender, 50);
      } else {
        console.error('Slide container not found after multiple attempts');
        this.errorMessage = 'Failed to render slide: container not available. Please try uploading again.';
        this.cdr.detectChanges();
      }
    };

    tryRender();
  }

  selectPresentation(index: number): void {
    if (index >= 0 && index < this.powerpointFiles.length) {
      this.currentFileIndex = index;
      this.loadPresentation(this.powerpointFiles[index]);
    }
  }

  previousSlide(): void {
    if (this.currentPresentation && this.currentSlide > 1) {
      this.currentSlide--;
      this.loadPresentation(this.currentPresentation);
    }
  }

  nextSlide(): void {
    if (this.currentPresentation && this.currentSlide < this.currentPresentation.totalSlides) {
      this.currentSlide++;
      this.loadPresentation(this.currentPresentation);
    }
  }

  goToSlide(slideNumber: number): void {
    if (this.currentPresentation) {
      const slide = Math.max(1, Math.min(slideNumber, this.currentPresentation.totalSlides));
      this.currentSlide = slide;
      this.loadPresentation(this.currentPresentation);
    }
  }

  removePresentation(index: number): void {
    if (index >= 0 && index < this.powerpointFiles.length) {
      const removedFile = this.powerpointFiles.splice(index, 1)[0];
      URL.revokeObjectURL(removedFile.url);

      // Clean up image URLs from slides
      removedFile.slides.forEach(slide => {
        if (slide.htmlContent) {
          const imgTags = slide.htmlContent.match(/<img[^>]+src="([^"]+)"/g);
          if (imgTags) {
            imgTags.forEach(imgTag => {
              const srcMatch = imgTag.match(/src="([^"]+)"/);
              if (srcMatch && srcMatch[1].startsWith('blob:')) {
                URL.revokeObjectURL(srcMatch[1]);
              }
            });
          }
        }
      });

      if (this.powerpointFiles.length === 0) {
        this.currentFileIndex = -1;
        this.currentSlide = 1;
        if (this.slideContainer?.nativeElement) {
          this.slideContainer.nativeElement.innerHTML = '';
        }
      } else if (index === this.currentFileIndex) {
        this.currentFileIndex = Math.min(index, this.powerpointFiles.length - 1);
        this.loadPresentation(this.powerpointFiles[this.currentFileIndex]);
      } else if (index < this.currentFileIndex) {
        this.currentFileIndex--;
      }
      this.cdr.detectChanges();
    }
  }

  clearAll(): void {
    this.powerpointFiles.forEach(file => {
      URL.revokeObjectURL(file.url);
      file.slides.forEach(slide => {
        if (slide.htmlContent) {
          const imgTags = slide.htmlContent.match(/<img[^>]+src="([^"]+)"/g);
          if (imgTags) {
            imgTags.forEach(imgTag => {
              const srcMatch = imgTag.match(/src="([^"]+)"/);
              if (srcMatch && srcMatch[1].startsWith('blob:')) {
                URL.revokeObjectURL(srcMatch[1]);
              }
            });
          }
        }
      });
    });
    this.powerpointFiles = [];
    this.currentFileIndex = -1;
    this.currentSlide = 1;
    this.loading = false;
    this.errorMessage = '';
    if (this.slideContainer?.nativeElement) {
      this.slideContainer.nativeElement.innerHTML = '';
    }
    this.cdr.detectChanges();
  }

  downloadPresentation(): void {
    if (!this.currentPresentation) return;

    const link = document.createElement('a');
    link.href = this.currentPresentation.url;
    link.download = this.currentPresentation.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  printPresentation(): void {
    if (!this.currentPresentation) return;

    const currentSlideData = this.currentPresentation.slides[this.currentSlide - 1];
    if (!currentSlideData) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${this.currentPresentation.name} - Slide ${this.currentSlide}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .slide-content { max-width: 800px; margin: 0 auto; }
              img { max-width: 100%; height: auto; }
            </style>
          </head>
          <body>
            <div class="slide-content">
              ${currentSlideData.htmlContent}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  getPresentationTypeLabel(type: PresentationType): string {
    switch (type) {
      case PresentationType.PPTX: return 'PPTX';
      case PresentationType.PPT: return 'PPT';
      case PresentationType.ODP: return 'ODP';
      default: return 'Unknown';
    }
  }

  zoomIn(): void {
    if (this.zoomLevel < 200) {
      this.zoomLevel = Math.min(this.zoomLevel + 25, 200);
      this.updateZoom();
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > 50) {
      this.zoomLevel = Math.max(this.zoomLevel - 25, 50);
      this.updateZoom();
    }
  }

  fitToWidth(): void {
    this.zoomLevel = 100;
    this.updateZoom();
  }

  resetZoom(): void {
    this.zoomLevel = 100;
    this.updateZoom();
  }

  updateZoom(): void {
    const container = this.isFullscreen 
      ? this.fullscreenSlideContainer?.nativeElement 
      : (this.slideContainer?.nativeElement || document.querySelector('.slide-content-wrapper') as HTMLDivElement);
    if (container) {
      container.style.zoom = `${this.zoomLevel}%`;
    }
    this.cdr.detectChanges();
  }

  enterFullscreen(): void {
    if (!this.currentPresentation) return;

    this.isFullscreen = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      const container = this.fullscreenContainer?.nativeElement;
      if (!container) {
        console.error('Fullscreen container not found');
        this.isFullscreen = false;
        this.cdr.detectChanges();
        return;
      }

      if (container.requestFullscreen) {
        container.requestFullscreen().catch((err: Error) => {
          console.error('Error attempting to enable fullscreen:', err);
          this.isFullscreen = false;
          this.cdr.detectChanges();
        });
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any).mozRequestFullScreen) {
        (container as any).mozRequestFullScreen();
      } else if ((container as any).msRequestFullscreen) {
        (container as any).msRequestFullscreen();
      } else {
        container.classList.add('fullscreen-active');
        this.isFullscreen = true;
      }

      setTimeout(() => {
        this.loadPresentation(this.currentPresentation!);
      }, 100);
    }, 0);
  }

  exitFullscreen(): void {
    this.isFullscreen = false;

    if (document.exitFullscreen) {
      document.exitFullscreen().catch((err: Error) => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }

    if (this.fullscreenContainer?.nativeElement) {
      this.fullscreenContainer.nativeElement.classList.remove('fullscreen-active');
    }

    setTimeout(() => {
      if (this.currentPresentation) {
        this.loadPresentation(this.currentPresentation);
      }
    }, 100);

    this.cdr.detectChanges();
  }

  toggleFullscreen(): void {
    if (this.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  setupFullscreenListeners(): void {
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    for (const eventName of events) {
      document.addEventListener(eventName, this.fullscreenChangeHandler);
    }
  }

  onFullscreenChange(): void {
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    if (!isCurrentlyFullscreen && this.isFullscreen) {
      this.isFullscreen = false;
      this.cdr.detectChanges();
    }
  }

  cleanup(): void {
    // Remove event listeners
    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }

    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    for (const eventName of events) {
      document.removeEventListener(eventName, this.fullscreenChangeHandler);
    }

    // Clean up object URLs
    this.powerpointFiles.forEach(file => {
      URL.revokeObjectURL(file.url);
      file.slides.forEach(slide => {
        if (slide.htmlContent) {
          const imgTags = slide.htmlContent.match(/<img[^>]+src="([^"]+)"/g);
          if (imgTags) {
            imgTags.forEach(imgTag => {
              const srcMatch = imgTag.match(/src="([^"]+)"/);
              if (srcMatch && srcMatch[1].startsWith('blob:')) {
                URL.revokeObjectURL(srcMatch[1]);
              }
            });
          }
        }
      });
    });
  }
}

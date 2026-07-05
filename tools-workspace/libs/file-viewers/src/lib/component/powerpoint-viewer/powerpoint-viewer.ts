import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

// PPTX parsing library types
interface PptxSlide {
  id: number;
  elements: PptxElement[];
  background?: string;
  notes?: string;
}

interface PptxElement {
  type: 'text' | 'image' | 'shape' | 'table';
  content?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  style?: any;
  imageData?: string;
}

interface PptxData {
  slides: PptxSlide[];
  metadata?: {
    title?: string;
    author?: string;
    created?: string;
  };
}

// Load JSZip library dynamically from CDN for PPTX parsing
async function loadJSZip(): Promise<any> {
  if (globalThis.window === undefined) {
    throw new TypeError('JSZip can only be loaded in browser environment');
  }

  // Check if already loaded
  if ((globalThis as any).JSZip) {
    return (globalThis as any).JSZip;
  }

  // Load JSZip from CDN
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    script.onload = () => {
      const JSZip = (globalThis as any).JSZip;
      (globalThis as any).JSZip = JSZip;
      resolve(JSZip);
    };
    script.onerror = () => reject(new Error('Failed to load JSZip library'));
  });
}

// File type detection
enum PresentationType {
  PPTX = 'pptx',
  UNSUPPORTED = 'unsupported'
}

function detectPresentationType(file: File): PresentationType {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (fileName.endsWith('.pptx') || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return PresentationType.PPTX;
  }

  return PresentationType.UNSUPPORTED;
}

interface PresentationFile {
  name: string;
  file: File;
  url: string;
  size: number;
  presentationType: PresentationType;
  slides: PptxSlide[];
  totalSlides: number;
  currentSlideIndex: number;
  metadata?: {
    title?: string;
    author?: string;
    created?: string;
  };
}

@Component({
  selector: 'lib-powerpoint-viewer',
  standalone: true,
  templateUrl: './powerpoint-viewer.html',
  styleUrls: ['./powerpoint-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective]
})
export class PowerpointViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('slideContainer') slideContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenContainer') fullscreenContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenSlideContainer') fullscreenSlideContainer!: ElementRef<HTMLDivElement>;
  
  presentationFiles: PresentationFile[] = [];
  currentFileIndex: number = -1;
  currentSlide: number = 1;
  totalSlides: number = 0;
  zoomLevel: number = 100;
  isFullscreen: boolean = false;
  loading: boolean = false;
  errorMessage: string = '';
  showDropZone: boolean = false;
  
  // Drag and drop handlers
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly fullscreenChangeHandler = () => this.onFullscreenChange();
  
  readonly supportedFormats = ['.pptx'];
  
  readonly maxFileSize = 100 * 1024 * 1024; // 100MB

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.setupDragAndDrop();
    this.setupFullscreenListeners();
  }

  ngAfterViewInit(): void {
    // Pre-load JSZip library
    loadJSZip().catch(err => {
      console.warn('Failed to pre-load JSZip:', err);
    });
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  get currentPresentation(): PresentationFile | null {
    return this.currentFileIndex >= 0 && this.currentFileIndex < this.presentationFiles.length
      ? this.presentationFiles[this.currentFileIndex]
      : null;
  }

  setupDragAndDrop(): void {
    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.addEventListener(eventName, this.preventDefaultsFn, false);
      document.body.addEventListener(eventName, this.preventDefaultsFn, false);
    }
  }

  setupFullscreenListeners(): void {
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    for (const eventName of events) {
      document.addEventListener(eventName, this.fullscreenChangeHandler);
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
    this.cdr.detectChanges();
    
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const presType = detectPresentationType(file);
      
      if (presType === PresentationType.UNSUPPORTED) {
        errors.push(`${file.name}: Unsupported file format. Only PPTX files are supported.`);
        continue;
      }
      
      if (file.size > this.maxFileSize) {
        errors.push(`${file.name}: File too large (max ${this.formatFileSize(this.maxFileSize)})`);
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
        
        let slides: PptxSlide[] = [];
        let metadata: any = {};
        
        // Parse PPTX files using JSZip
        try {
          await loadJSZip();
          slides = await this.parsePptxManually(file);
        } catch (error) {
          console.error('Error parsing PPTX:', error);
          slides = [{
            id: 1,
            elements: [{
              type: 'text',
              content: 'Error parsing presentation',
              style: { fontSize: 16 }
            }, {
              type: 'text',
              content: error instanceof Error ? error.message : 'Failed to parse PPTX file. Please ensure the file is not corrupted.',
              style: { fontSize: 14 }
            }]
          }];
        }
        
        const presentationFile: PresentationFile = {
          name: file.name,
          file: file,
          url: url,
          size: file.size,
          presentationType: presType,
          slides: slides,
          totalSlides: slides.length,
          currentSlideIndex: 0,
          metadata: metadata
        };
        
        this.presentationFiles.push(presentationFile);
        
        this.cdr.detectChanges();
        
        if (this.currentFileIndex === -1) {
          this.currentFileIndex = this.presentationFiles.length - 1;
          this.currentSlide = 1;
          this.totalSlides = presentationFile.totalSlides;
          requestAnimationFrame(() => {
            setTimeout(() => {
              this.loadPresentation(presentationFile);
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
    
    this.cdr.detectChanges();
  }

  async parsePptxManually(file: File): Promise<PptxSlide[]> {
    // Manual PPTX parsing using JSZip
    const JSZip = (globalThis as any).JSZip;
    if (!JSZip) {
      throw new Error('JSZip library not available');
    }

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const slides: PptxSlide[] = [];
    
    // Get slide files (sorted by slide number)
    const slideFiles = Object.keys(zip.files)
      .filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
        const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
        return numA - numB;
      });

    for (let i = 0; i < slideFiles.length; i++) {
      const slideFile = slideFiles[i];
      try {
        const xmlContent = await zip.files[slideFile].async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        
        const elements: PptxElement[] = [];
        
        // Extract text elements - handle namespaces properly
        // PPTX uses namespaces, so we need to search for text in multiple ways
        const allTextNodes: string[] = [];
        
        // Method 1: Get all text nodes using TreeWalker
        try {
          const walker = xmlDoc.createTreeWalker(
            xmlDoc,
            NodeFilter.SHOW_TEXT,
            null
          );
          
          let textNode;
          while (textNode = walker.nextNode()) {
            const text = textNode.textContent?.trim();
            if (text && text.length > 0) {
              allTextNodes.push(text);
            }
          }
        } catch (e) {
          console.warn('TreeWalker failed, trying alternative methods:', e);
        }
        
        // Method 2: Try to get text from 'a:t' elements (drawingML text)
        try {
          const textElements = xmlDoc.getElementsByTagName('a:t');
          for (let j = 0; j < textElements.length; j++) {
            const text = textElements[j].textContent?.trim();
            if (text && text.length > 0 && !allTextNodes.includes(text)) {
              allTextNodes.push(text);
            }
          }
        } catch (e) {
          // Ignore namespace errors
        }
        
        // Method 3: Try querySelectorAll with namespace-agnostic selector
        try {
          const allTextElements = xmlDoc.querySelectorAll('*[local-name()="t"]');
          for (let j = 0; j < allTextElements.length; j++) {
            const text = allTextElements[j].textContent?.trim();
            if (text && text.length > 0 && !allTextNodes.includes(text)) {
              allTextNodes.push(text);
            }
          }
        } catch (e) {
          // Continue if selector fails
        }
        
        // Method 4: Get all text from the XML as a fallback
        const xmlText = xmlDoc.textContent || xmlDoc.documentElement?.textContent || '';
        if (xmlText) {
          // Split by whitespace and filter meaningful text
          const words = xmlText.split(/\s+/).filter(w => w.length > 2);
          if (words.length > 0) {
            // This is a fallback - try to extract meaningful sentences
            const sentences = xmlText.match(/[^.!?]+[.!?]+/g) || [];
            sentences.forEach(sentence => {
              const trimmed = sentence.trim();
              if (trimmed.length > 3 && !allTextNodes.includes(trimmed)) {
                allTextNodes.push(trimmed);
              }
            });
          }
        }
        
        // Filter and process text
        if (allTextNodes.length > 0) {
          // Remove duplicates and filter meaningful text
          const uniqueText = Array.from(new Set(allTextNodes))
            .filter(t => t.length > 2 && !t.match(/^[0-9\s]+$/)); // Filter out numbers only
          
          if (uniqueText.length > 0) {
            // Create text elements
            uniqueText.forEach((text, idx) => {
              elements.push({
                type: 'text',
                content: text,
                style: { 
                  fontSize: idx === 0 ? 20 : 16,
                  fontWeight: idx === 0 ? 'bold' : 'normal'
                }
              });
            });
          }
        }
        
        // Extract images - look for relationship IDs in blip elements
        try {
          const blipElements = xmlDoc.getElementsByTagName('a:blip');
          for (let j = 0; j < blipElements.length; j++) {
            const blipEl = blipElements[j];
            const embed = blipEl.getAttribute('r:embed') || blipEl.getAttribute('embed');
            
            if (embed) {
              // Get the relationship file to find the actual image path
              const relFile = `ppt/slides/_rels/${slideFile.split('/').pop()?.replace('.xml', '')}.rels`;
              try {
                const relContent = await zip.files[relFile]?.async('string');
                if (relContent) {
                  const relDoc = parser.parseFromString(relContent, 'text/xml');
                  const relationships = relDoc.getElementsByTagName('Relationship');
                  
                  for (let k = 0; k < relationships.length; k++) {
                    const rel = relationships[k];
                    if (rel.getAttribute('Id') === embed) {
                      const target = rel.getAttribute('Target');
                      if (target) {
                        // Resolve relative path
                        const imagePath = target.startsWith('../') 
                          ? `ppt/${target.replace('../', '')}`
                          : `ppt/slides/${target}`;
                        
                        const imageFile = zip.files[imagePath];
                        if (imageFile) {
                          const imageData = await imageFile.async('base64');
                          const ext = imagePath.split('.').pop()?.toLowerCase() || 'png';
                          elements.push({
                            type: 'image',
                            imageData: `data:image/${ext};base64,${imageData}`
                          });
                          break;
                        }
                      }
                    }
                  }
                }
              } catch (relErr) {
                // Try direct media path
                const mediaFiles = Object.keys(zip.files).filter(name => 
                  name.startsWith('ppt/media/') && name.includes(embed)
                );
                if (mediaFiles.length > 0) {
                  try {
                    const imageFile = zip.files[mediaFiles[0]];
                    const imageData = await imageFile.async('base64');
                    const ext = mediaFiles[0].split('.').pop()?.toLowerCase() || 'png';
                    elements.push({
                      type: 'image',
                      imageData: `data:image/${ext};base64,${imageData}`
                    });
                  } catch (imgErr) {
                    console.warn('Failed to extract image:', imgErr);
                  }
                }
              }
            }
          }
        } catch (imgErr) {
          console.warn('Error extracting images:', imgErr);
        }
        
        // If no elements found, add a placeholder
        if (elements.length === 0) {
          elements.push({
            type: 'text',
            content: `Slide ${i + 1} (No content found)`,
            style: { fontSize: 18, fontWeight: 'bold' }
          });
        }
        
        slides.push({
          id: i + 1,
          elements: elements
        });
      } catch (err) {
        console.warn(`Failed to parse slide ${i + 1}:`, err);
        // Add a placeholder slide
        slides.push({
          id: i + 1,
          elements: [{
            type: 'text',
            content: `Slide ${i + 1} (Unable to parse)`,
            style: { fontSize: 16 }
          }]
        });
      }
    }
    
    return slides.length > 0 ? slides : [{
      id: 1,
      elements: [{
        type: 'text',
        content: 'Unable to parse presentation content. The file may be corrupted or use unsupported features.',
        style: { fontSize: 16 }
      }]
    }];
  }

  closeError(): void {
    this.errorMessage = '';
    this.cdr.detectChanges();
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
      setTimeout(() => {
        this.renderSlide();
      }, 100);
      this.cdr.detectChanges();
    }
  }

  toggleFullscreen(): void {
    if (this.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  enterFullscreen(): void {
    if (!this.currentPresentation) return;
    
    this.isFullscreen = true;
    this.cdr.detectChanges();
    
    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = this.fullscreenContainer?.nativeElement;
        if (!container) {
          this.isFullscreen = false;
          this.cdr.detectChanges();
          return;
        }

        if (container.requestFullscreen) {
          container.requestFullscreen().then(() => {
            setTimeout(() => {
              this.renderSlide(true);
            }, 150);
          }).catch(() => {
            this.isFullscreen = false;
            this.cdr.detectChanges();
          });
        } else if ((container as any).webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
          setTimeout(() => {
            this.renderSlide(true);
          }, 150);
        } else if ((container as any).mozRequestFullScreen) {
          (container as any).mozRequestFullScreen();
          setTimeout(() => {
            this.renderSlide(true);
          }, 150);
        } else if ((container as any).msRequestFullscreen) {
          (container as any).msRequestFullscreen();
          setTimeout(() => {
            this.renderSlide(true);
          }, 150);
        } else {
          container.classList.add('fullscreen-active');
          setTimeout(() => {
            this.renderSlide(true);
          }, 150);
        }
      }, 50);
    });
  }

  exitFullscreen(): void {
    this.isFullscreen = false;
    
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
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
      this.renderSlide();
    }, 100);
    
    this.cdr.detectChanges();
  }

  async loadPresentation(presentationFile: PresentationFile): Promise<void> {
    if (!presentationFile || presentationFile.slides.length === 0) {
      this.errorMessage = 'Presentation has no slides';
      this.cdr.detectChanges();
      return;
    }
    
    this.currentSlide = 1;
    this.totalSlides = presentationFile.totalSlides;
    this.cdr.detectChanges();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    this.renderSlide();
  }

  selectPresentation(index: number): Promise<void> {
    if (index >= 0 && index < this.presentationFiles.length) {
      this.currentFileIndex = index;
      const pres = this.presentationFiles[index];
      this.currentSlide = 1;
      this.totalSlides = pres.totalSlides;
      return this.loadPresentation(pres);
    }
    return Promise.resolve();
  }

  previousSlide(): void {
    if (this.currentSlide > 1) {
      this.currentSlide--;
      this.renderSlide();
    }
  }

  nextSlide(): void {
    if (this.currentSlide < this.totalSlides) {
      this.currentSlide++;
      this.renderSlide();
    }
  }

  goToSlide(slideNumber: number): void {
    const slide = Math.max(1, Math.min(slideNumber, this.totalSlides));
    if (slide !== this.currentSlide) {
      this.currentSlide = slide;
      this.renderSlide();
    }
  }

  renderSlide(isFullscreen: boolean = false): void {
    if (!this.currentPresentation) return;
    
    const slideIndex = this.currentSlide - 1;
    if (slideIndex < 0 || slideIndex >= this.currentPresentation.slides.length) {
      return;
    }
    
    const slide = this.currentPresentation.slides[slideIndex];
    const container = isFullscreen 
      ? this.fullscreenSlideContainer?.nativeElement 
      : this.slideContainer?.nativeElement;
    
    if (!container) {
      // Retry after a short delay
      setTimeout(() => this.renderSlide(isFullscreen), 50);
      return;
    }
    
    // Render slide content
    let html = `<div class="slide-content" style="zoom: ${this.zoomLevel}%;">`;
    
    for (const element of slide.elements) {
      if (element.type === 'text') {
        const style = element.style || {};
        html += `<div class="slide-text" style="font-size: ${style.fontSize || 16}px; font-weight: ${style.fontWeight || 'normal'}; margin: 10px 0;">${this.escapeHtml(element.content || '')}</div>`;
      } else if (element.type === 'image' && element.imageData) {
        html += `<img src="${element.imageData}" class="slide-image" style="max-width: 100%; height: auto; margin: 10px 0;" />`;
      }
    }
    
    html += `</div>`;
    container.innerHTML = html;
    this.cdr.detectChanges();
  }

  zoomIn(): void {
    if (this.zoomLevel < 300) {
      this.zoomLevel = Math.min(this.zoomLevel + 25, 300);
      this.renderSlide(this.isFullscreen);
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > 50) {
      this.zoomLevel = Math.max(this.zoomLevel - 25, 50);
      this.renderSlide(this.isFullscreen);
    }
  }

  resetZoom(): void {
    this.zoomLevel = 100;
    this.renderSlide(this.isFullscreen);
  }

  fitToWidth(): void {
    // Simplified fit to width
    this.zoomLevel = 100;
    this.renderSlide(this.isFullscreen);
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
    
    const slideIndex = this.currentSlide - 1;
    if (slideIndex < 0 || slideIndex >= this.currentPresentation.slides.length) {
      return;
    }
    
    const slide = this.currentPresentation.slides[slideIndex];
    let html = '<div style="padding: 40px; font-family: Arial, sans-serif;">';
    
    for (const element of slide.elements) {
      if (element.type === 'text') {
        html += `<div style="margin: 10px 0;">${this.escapeHtml(element.content || '')}</div>`;
      } else if (element.type === 'image' && element.imageData) {
        html += `<img src="${element.imageData}" style="max-width: 100%;" />`;
      }
    }
    
    html += '</div>';
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${this.currentPresentation.name} - Slide ${this.currentSlide}</title>
            <style>
              body { margin: 0; padding: 20px; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  removePresentation(index: number): void {
    if (index >= 0 && index < this.presentationFiles.length) {
      const presFile = this.presentationFiles[index];
      
      if (presFile.url) {
        URL.revokeObjectURL(presFile.url);
      }
      
      this.presentationFiles.splice(index, 1);
      
      if (this.currentFileIndex === index) {
        if (this.presentationFiles.length > 0) {
          this.currentFileIndex = Math.min(index, this.presentationFiles.length - 1);
          this.loadPresentation(this.presentationFiles[this.currentFileIndex]);
        } else {
          this.currentFileIndex = -1;
          this.currentSlide = 1;
          this.totalSlides = 0;
          if (this.slideContainer?.nativeElement) {
            this.slideContainer.nativeElement.innerHTML = '';
          }
        }
      } else if (this.currentFileIndex > index) {
        this.currentFileIndex--;
      }
      
      this.cdr.detectChanges();
    }
  }

  clearAll(): void {
    if (this.isFullscreen) {
      this.exitFullscreen();
    }
    
    for (const presFile of this.presentationFiles) {
      if (presFile.url) {
        URL.revokeObjectURL(presFile.url);
      }
    }
    
    this.presentationFiles = [];
    this.currentFileIndex = -1;
    this.currentSlide = 1;
    this.totalSlides = 0;
    
    if (this.slideContainer?.nativeElement) {
      this.slideContainer.nativeElement.innerHTML = '';
    }
    
    if (this.fullscreenSlideContainer?.nativeElement) {
      this.fullscreenSlideContainer.nativeElement.innerHTML = '';
    }
    
    this.cdr.detectChanges();
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getPresentationTypeLabel(type: PresentationType): string {
    switch (type) {
      case PresentationType.PPTX: return 'PPTX';
      default: return 'Unknown';
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      this.previousSlide();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      this.nextSlide();
    } else if (e.key === 'Escape' && this.isFullscreen) {
      this.exitFullscreen();
    }
  }

  cleanup(): void {
    if (this.isFullscreen) {
      this.exitFullscreen();
    }
    
    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }
    
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    for (const eventName of events) {
      document.removeEventListener(eventName, this.fullscreenChangeHandler);
    }
    
    this.clearAll();
  }
}

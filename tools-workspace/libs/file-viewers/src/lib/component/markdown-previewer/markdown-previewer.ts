import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

// Marked library types
interface MarkedOptions {
  breaks?: boolean;
  gfm?: boolean;
  headerIds?: boolean;
  mangle?: boolean;
  pedantic?: boolean;
  sanitize?: boolean;
  silent?: boolean;
  smartLists?: boolean;
  smartypants?: boolean;
  xhtml?: boolean;
}

declare const marked: {
  parse(markdown: string, options?: MarkedOptions): string;
  setOptions(options: MarkedOptions): void;
};

// DOMPurify for sanitization
declare const DOMPurify: {
  sanitize(dirty: string, config?: any): string;
};

// Load marked library dynamically from CDN
async function loadMarked(): Promise<typeof marked> {
  if (globalThis.window === undefined) {
    throw new TypeError('Marked can only be loaded in browser environment');
  }

  // Check if already loaded
  if ((globalThis as any).marked) {
    return (globalThis as any).marked;
  }

  // Load marked from CDN
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js';
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    script.onload = () => {
      const markedLib = (globalThis as any).marked;
      (globalThis as any).marked = markedLib;
      // Configure marked options
      markedLib.setOptions({
        breaks: true,
        gfm: true,
        headerIds: true,
        mangle: false
      });
      resolve(markedLib);
    };
    script.onerror = () => reject(new Error('Failed to load marked library'));
  });
}

// Load DOMPurify for sanitization
async function loadDOMPurify(): Promise<typeof DOMPurify> {
  if (globalThis.window === undefined) {
    throw new TypeError('DOMPurify can only be loaded in browser environment');
  }

  // Check if already loaded
  if ((globalThis as any).DOMPurify) {
    return (globalThis as any).DOMPurify;
  }

  // Load DOMPurify from CDN
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js';
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    script.onload = () => {
      const purify = (globalThis as any).DOMPurify;
      (globalThis as any).DOMPurify = purify;
      resolve(purify);
    };
    script.onerror = () => reject(new Error('Failed to load DOMPurify library'));
  });
}

interface MarkdownFile {
  name: string;
  file: File;
  url: string;
  size: number;
  content: string;
  htmlContent: string;
  lines: number;
  lastModified: Date;
}

@Component({
  selector: 'lib-markdown-previewer',
  standalone: true,
  templateUrl: './markdown-previewer.html',
  styleUrls: ['./markdown-previewer.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective]
})
export class MarkdownPreviewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('previewContainer') previewContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenContainer') fullscreenContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenPreviewContainer') fullscreenPreviewContainer!: ElementRef<HTMLDivElement>;
  
  markdownFiles: MarkdownFile[] = [];
  currentFileIndex: number = -1;
  loading: boolean = false;
  errorMessage: string = '';
  showDropZone: boolean = false;
  zoomLevel: number = 100;
  isFullscreen: boolean = false;
  renderMode: 'preview' | 'source' | 'split' = 'preview';
  
  // Drag and drop handlers
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly fullscreenChangeHandler = () => this.onFullscreenChange();
  
  readonly supportedFormats = ['.md', '.markdown', '.mdown', '.mkdn', '.mkd'];
  readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.setupDragAndDrop();
    this.setupFullscreenListeners();
  }

  ngAfterViewInit(): void {
    // Pre-load libraries
    Promise.all([loadMarked(), loadDOMPurify()]).catch(err => {
      console.warn('Failed to pre-load markdown libraries:', err);
    });
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  get currentFile(): MarkdownFile | null {
    return this.currentFileIndex >= 0 && this.currentFileIndex < this.markdownFiles.length
      ? this.markdownFiles[this.currentFileIndex]
      : null;
  }

  get loadedFilesCount(): number {
    return this.markdownFiles.length;
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
    
    // Load libraries
    let markedLib: typeof marked;
    let purify: typeof DOMPurify;
    
    try {
      [markedLib, purify] = await Promise.all([loadMarked(), loadDOMPurify()]);
    } catch (error) {
      this.loading = false;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.errorMessage = `Failed to load markdown libraries: ${message}. Please refresh the page.`;
      this.cdr.detectChanges();
      return;
    }
    
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const fileName = file.name.toLowerCase();
      const isMarkdown = this.supportedFormats.some(ext => fileName.endsWith(ext)) ||
                        file.type === 'text/markdown' ||
                        file.type === 'text/x-markdown';
      
      if (!isMarkdown) {
        errors.push(`${file.name}: Unsupported file format. Only Markdown files (.md, .markdown) are supported.`);
        continue;
      }
      
      if (file.size > this.maxFileSize) {
        errors.push(`${file.name}: File too large (max ${this.formatFileSize(this.maxFileSize)})`);
        continue;
      }
      
      if (file.size === 0) {
        errors.push(`${file.name}: File is empty`);
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
        const content = await file.text();
        
        // Validate content is not empty after trimming
        if (!content.trim()) {
          errors.push(`${file.name}: File contains no content`);
          URL.revokeObjectURL(url);
          continue;
        }
        
        // Parse markdown to HTML
        let htmlContent = '';
        try {
          const rawHtml = markedLib.parse(content);
          // Sanitize HTML to prevent XSS attacks
          htmlContent = purify.sanitize(rawHtml, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                          'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'hr', 
                          'table', 'thead', 'tbody', 'tr', 'th', 'td', 'del', 'ins', 'sub', 'sup'],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id']
          });
        } catch (parseError) {
          console.warn('Markdown parsing error:', parseError);
          htmlContent = `<div class="markdown-error">
            <p><strong>Error parsing Markdown:</strong></p>
            <p>${this.escapeHtml(parseError instanceof Error ? parseError.message : 'Unknown parsing error')}</p>
            <p>The file may contain invalid Markdown syntax. Showing raw content below:</p>
            <pre>${this.escapeHtml(content)}</pre>
          </div>`;
        }
        
        const lines = content.split('\n').length;
        
        const markdownFile: MarkdownFile = {
          name: file.name,
          file: file,
          url: url,
          size: file.size,
          content: content,
          htmlContent: htmlContent,
          lines: lines,
          lastModified: new Date(file.lastModified)
        };
        
        this.markdownFiles.push(markdownFile);
        
        this.cdr.detectChanges();
        
        if (this.currentFileIndex === -1) {
          this.currentFileIndex = this.markdownFiles.length - 1;
          requestAnimationFrame(() => {
            setTimeout(() => {
              this.renderMarkdown(markdownFile);
            }, 50);
          });
        }
      } catch (error) {
        errors.push(`${file.name}: Failed to load file - ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  async renderMarkdown(markdownFile: MarkdownFile): Promise<void> {
    if (!markdownFile) {
      this.errorMessage = 'No markdown file to render';
      this.cdr.detectChanges();
      return;
    }
    
    this.cdr.detectChanges();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const getContentDiv = (): HTMLDivElement | null => {
      if (this.isFullscreen) {
        // For fullscreen, use the fullscreen preview container directly
        return this.fullscreenPreviewContainer?.nativeElement || null;
      } else {
        // For normal view, find the content div inside the container
        const container = this.previewContainer?.nativeElement;
        if (container) {
          let contentDiv = container.querySelector('.markdown-preview-content') as HTMLDivElement;
          if (!contentDiv) {
            // Create the content div if it doesn't exist
            contentDiv = document.createElement('div');
            contentDiv.className = 'markdown-preview-content';
            container.appendChild(contentDiv);
          }
          return contentDiv;
        }
        return document.querySelector('.markdown-preview-content') as HTMLDivElement;
      }
    };
    
    let attempts = 0;
    const maxAttempts = 30;
    let renderComplete = false;
    
    const tryRender = (): void => {
      attempts++;
      const contentDiv = getContentDiv();
      
      if (contentDiv) {
        // Clear and set content
        contentDiv.innerHTML = markdownFile.htmlContent;
        // Apply zoom to the content div
        this.updateZoom(contentDiv);
        this.cdr.detectChanges();
        // Scroll container to top
        const container = this.isFullscreen 
          ? this.fullscreenContainer?.nativeElement?.querySelector('.fullscreen-preview-container')
          : this.previewContainer?.nativeElement;
        if (container) {
          container.scrollTop = 0;
        }
        renderComplete = true;
        return;
      }
      
      if (attempts < maxAttempts) {
        this.cdr.detectChanges();
        setTimeout(tryRender, 50);
      } else {
        console.error('Preview content div not found after multiple attempts');
        this.errorMessage = 'Failed to render markdown: container not available. Please try uploading again.';
        this.cdr.detectChanges();
      }
    };
    
    tryRender();
  }

  selectFile(index: number): Promise<void> {
    if (index >= 0 && index < this.markdownFiles.length) {
      this.currentFileIndex = index;
      return this.renderMarkdown(this.markdownFiles[index]);
    }
    return Promise.resolve();
  }

  removeFile(index: number): void {
    if (index >= 0 && index < this.markdownFiles.length) {
      const markdownFile = this.markdownFiles[index];
      
      if (markdownFile.url) {
        URL.revokeObjectURL(markdownFile.url);
      }
      
      this.markdownFiles.splice(index, 1);
      
      if (this.currentFileIndex === index) {
        if (this.markdownFiles.length > 0) {
          this.currentFileIndex = Math.min(index, this.markdownFiles.length - 1);
          this.renderMarkdown(this.markdownFiles[this.currentFileIndex]);
        } else {
          this.currentFileIndex = -1;
          if (this.previewContainer?.nativeElement) {
            this.previewContainer.nativeElement.innerHTML = '';
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
    
    for (const markdownFile of this.markdownFiles) {
      if (markdownFile.url) {
        URL.revokeObjectURL(markdownFile.url);
      }
    }
    
    this.markdownFiles = [];
    this.currentFileIndex = -1;
    
    if (this.previewContainer?.nativeElement) {
      this.previewContainer.nativeElement.innerHTML = '';
    }
    
    if (this.fullscreenPreviewContainer?.nativeElement) {
      this.fullscreenPreviewContainer.nativeElement.innerHTML = '';
    }
    
    this.cdr.detectChanges();
  }

  toggleRenderMode(): void {
    if (this.renderMode === 'preview') {
      this.renderMode = 'source';
    } else if (this.renderMode === 'source') {
      this.renderMode = 'split';
    } else {
      this.renderMode = 'preview';
    }
    if (this.currentFile) {
      this.renderMarkdown(this.currentFile);
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

  resetZoom(): void {
    this.zoomLevel = 100;
    this.updateZoom();
  }

  updateZoom(container?: HTMLDivElement): void {
    const targetContainer = container || (() => {
      if (this.isFullscreen) {
        return this.fullscreenPreviewContainer?.nativeElement;
      } else {
        const previewContainer = this.previewContainer?.nativeElement;
        return previewContainer?.querySelector('.markdown-preview-content') as HTMLDivElement;
      }
    })();
    
    if (targetContainer) {
      targetContainer.style.fontSize = `${this.zoomLevel}%`;
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
    if (!this.currentFile) return;
    
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

        const requestFullscreen = () => {
          if (container.requestFullscreen) {
            container.requestFullscreen().then(() => {
              setTimeout(() => {
                if (this.currentFile) {
                  this.renderMarkdown(this.currentFile);
                }
              }, 150);
            }).catch(() => {
              this.isFullscreen = false;
              this.cdr.detectChanges();
            });
          } else if ((container as any).webkitRequestFullscreen) {
            (container as any).webkitRequestFullscreen();
            setTimeout(() => {
              if (this.currentFile) {
                this.renderMarkdown(this.currentFile);
              }
            }, 150);
          } else if ((container as any).mozRequestFullScreen) {
            (container as any).mozRequestFullScreen();
            setTimeout(() => {
              if (this.currentFile) {
                this.renderMarkdown(this.currentFile);
              }
            }, 150);
          } else if ((container as any).msRequestFullscreen) {
            (container as any).msRequestFullscreen();
            setTimeout(() => {
              if (this.currentFile) {
                this.renderMarkdown(this.currentFile);
              }
            }, 150);
          } else {
            container.classList.add('fullscreen-active');
            setTimeout(() => {
              if (this.currentFile) {
                this.renderMarkdown(this.currentFile);
              }
            }, 150);
          }
        };

        requestFullscreen();
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
      if (this.currentFile) {
        this.renderMarkdown(this.currentFile);
      }
      this.cdr.detectChanges();
    }, 150);
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

  downloadFile(): void {
    if (!this.currentFile) return;
    
    const link = document.createElement('a');
    link.href = this.currentFile.url;
    link.download = this.currentFile.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  printFile(): void {
    if (!this.currentFile) return;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${this.currentFile.name}</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                margin: 40px;
                line-height: 1.6;
                color: #333;
              }
              h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
              code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }
              pre { background: #f4f4f4; padding: 1em; border-radius: 5px; overflow-x: auto; }
              blockquote { border-left: 4px solid #ddd; padding-left: 1em; margin-left: 0; color: #666; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            ${this.currentFile.htmlContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  copyToClipboard(): void {
    if (!this.currentFile) return;
    
    navigator.clipboard.writeText(this.currentFile.content).then(() => {
      // Could show a toast notification here
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
      this.errorMessage = 'Failed to copy to clipboard';
      this.cdr.detectChanges();
    });
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

  closeError(): void {
    this.errorMessage = '';
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if (e.key === 'Escape' && this.isFullscreen) {
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

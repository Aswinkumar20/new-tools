import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

// Mammoth.js types - for DOCX files
interface MammothResult {
  value: string; // HTML string
  messages: Array<{ type: string; message: string }>;
}

declare const mammoth: {
  convertToHtml(arrayBuffer: ArrayBuffer, options?: any): Promise<MammothResult>;
  extractRawText(arrayBuffer: ArrayBuffer): Promise<{ value: string }>;
};

// Load Mammoth.js dynamically from CDN (for DOCX files)
async function loadMammoth(): Promise<typeof mammoth> {
  if (globalThis.window === undefined) {
    throw new TypeError('Mammoth.js can only be loaded in browser environment');
  }

  // Check if already loaded
  if ((globalThis as any).mammoth) {
    return (globalThis as any).mammoth;
  }

  // Load Mammoth.js from CDN
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    script.onload = () => {
      const mammothLib = (globalThis as any).mammoth;
      (globalThis as any).mammoth = mammothLib;
      resolve(mammothLib);
    };
    script.onerror = () => reject(new Error('Failed to load Mammoth.js library'));
  });
}

// File type detection and supported formats
enum DocumentType {
  DOCX = 'docx',
  DOC = 'doc',
  RTF = 'rtf',
  ODT = 'odt',
  TXT = 'txt',
  HTML = 'html',
  UNSUPPORTED = 'unsupported'
}

function detectDocumentType(file: File): DocumentType {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (fileName.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return DocumentType.DOCX;
  }
  if (fileName.endsWith('.doc') || mimeType === 'application/msword') {
    return DocumentType.DOC;
  }
  if (fileName.endsWith('.rtf') || mimeType === 'application/rtf' || mimeType === 'text/rtf') {
    return DocumentType.RTF;
  }
  if (fileName.endsWith('.odt') || mimeType === 'application/vnd.oasis.opendocument.text') {
    return DocumentType.ODT;
  }
  if (fileName.endsWith('.txt') || mimeType === 'text/plain') {
    return DocumentType.TXT;
  }
  if (fileName.endsWith('.html') || fileName.endsWith('.htm') || mimeType === 'text/html') {
    return DocumentType.HTML;
  }

  return DocumentType.UNSUPPORTED;
}

interface WordFile {
  name: string;
  file: File;
  url: string;
  size: number;
  htmlContent: string | null;
  textContent: string;
  documentType: DocumentType;
  needsPassword: boolean;
  passwordError: boolean;
}

@Component({
  selector: 'lib-word-viewer',
  standalone: true,
  templateUrl: './word-viewer.html',
  styleUrls: ['./word-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective]
})
export class FileViewerWordViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('documentContainer') documentContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenContainer') fullscreenContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenDocumentContainer') fullscreenDocumentContainer!: ElementRef<HTMLDivElement>;
  
  wordFiles: WordFile[] = [];
  currentWordIndex: number = -1;
  loading: boolean = false;
  errorMessage: string = '';
  showDropZone: boolean = false;
  zoomLevel: number = 100;
  isFullscreenView: boolean = false;
  
  // Drag and drop handlers
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly fullscreenChangeHandler = () => this.onFullscreenChange();
  
  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.setupDragAndDrop();
    this.setupFullscreenListeners();
  }

  ngAfterViewInit(): void {
    // Initialize Mammoth.js library
    loadMammoth().catch(err => {
      console.error('Failed to load Mammoth.js:', err);
      this.errorMessage = 'Failed to load Word viewer library. Please refresh the page.';
    });
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  get currentWord(): WordFile | null {
    return this.currentWordIndex >= 0 && this.currentWordIndex < this.wordFiles.length
      ? this.wordFiles[this.currentWordIndex]
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
    
    // Ensure Mammoth.js is loaded
    let mammothLib: typeof mammoth;
    try {
      mammothLib = await loadMammoth();
    } catch (error: unknown) {
      this.loading = false;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.errorMessage = `Failed to load Word viewer library: ${message}. Please refresh the page.`;
      console.error('Mammoth.js load error:', error);
      return;
    }
    
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const docType = detectDocumentType(file);
      
      if (docType === DocumentType.UNSUPPORTED) {
        errors.push(`${file.name}: Unsupported file format. Supported: DOCX, DOC, RTF, ODT, TXT, HTML`);
        continue;
      }
      
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        errors.push(`${file.name}: File too large (max 50MB)`);
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
        const docType = detectDocumentType(file);
        
        let htmlContent = '';
        let textContent = '';
        
        // Process different document types
        switch (docType) {
          case DocumentType.DOCX: {
            // Use Mammoth.js for DOCX files
            const arrayBuffer = await file.arrayBuffer();
            const conversionOptions = {
              arrayBuffer,
            };

            const convertToHtml = (mammothLib.convertToHtml as unknown as (options: unknown, config?: unknown) => Promise<MammothResult>);
            const extractRawText = (mammothLib.extractRawText as unknown as (options: unknown) => Promise<{ value: string }>);

            const result = await convertToHtml(conversionOptions, {
              styleMap: [
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Heading 2'] => h2:fresh",
                "p[style-name='Heading 3'] => h3:fresh",
                "p[style-name='Heading 4'] => h4:fresh",
                "p[style-name='Heading 5'] => h5:fresh",
                "p[style-name='Heading 6'] => h6:fresh"
              ]
            });
            
            htmlContent = result.value;
            const textResult = await extractRawText(conversionOptions);
            textContent = textResult.value;
            
            // Show warnings if any
            if (result.messages.length > 0) {
              const warnings = result.messages
                .filter(m => m.type === 'warning')
                .map(m => m.message)
                .join('; ');
              if (warnings) {
                console.warn(`Warnings for ${file.name}:`, warnings);
              }
            }
            break;
          }
            
          case DocumentType.DOC: {
            // For .doc files, we need to inform user that full support requires conversion
            // .doc files are binary format, so full support requires conversion
            htmlContent = `<div class="doc-content">
              <div style="padding: 2rem; text-align: center; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin: 2rem 0;">
                <h3 style="color: #856404; margin-bottom: 1rem;">Legacy DOC Format</h3>
                <p style="color: #856404; margin-bottom: 1rem;">
                  This is a legacy .doc file format. For best viewing experience, please convert it to .docx format.
                </p>
                <p style="color: #856404; font-size: 0.9rem;">
                  The .doc format is a binary format that requires special libraries to parse. 
                  For full support, please convert your .doc file to .docx format using Microsoft Word or an online converter.
                </p>
              </div>
              <p style="color: #757575; font-style: italic; margin-top: 1rem;">
                Note: Full .doc file support requires conversion to .docx format. 
                You can use Microsoft Word or online converters to convert your .doc file to .docx.
              </p>
            </div>`;
            textContent = 'Legacy DOC format - conversion to DOCX recommended for full support';
            break;
          }
            
          case DocumentType.RTF: {
            // RTF files - convert to HTML (basic support)
            const rtfText = await file.text();
            htmlContent = await this.convertRtfToHtml(rtfText);
            textContent = this.extractRtfText(rtfText);
            break;
          }
            
          case DocumentType.ODT: {
            // ODT files - try to extract content (limited support)
            // Full ODT support would require a library like odt2html
            htmlContent = `<div class="odt-content">
              <div style="padding: 2rem; text-align: center; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin: 2rem 0;">
                <h3 style="color: #856404; margin-bottom: 1rem;">ODT Format</h3>
                <p style="color: #856404;">
                  ODT (OpenDocument Text) files require conversion. Please convert to DOCX format for better support.
                </p>
              </div>
            </div>`;
            textContent = 'ODT file content extraction not fully supported. Please convert to DOCX.';
            break;
          }
            
          case DocumentType.TXT: {
            // Plain text files
            const txtContent = await file.text();
            htmlContent = `<div class="txt-content"><pre style="white-space: pre-wrap; font-family: inherit;">${this.escapeHtml(txtContent)}</pre></div>`;
            textContent = txtContent;
            break;
          }
            
          case DocumentType.HTML: {
            // HTML files
            const htmlText = await file.text();
            htmlContent = htmlText;
            textContent = this.extractTextFromHtml(htmlText);
            break;
          }
        }
        
        const wordFile: WordFile = {
          name: file.name,
          file: file,
          url: url,
          size: file.size,
          htmlContent: htmlContent,
          textContent: textContent,
          documentType: docType,
          needsPassword: false,
          passwordError: false
        };
        
        this.wordFiles.push(wordFile);
        
        // Wait for Angular to update the view
        this.cdr.detectChanges();
        
        if (this.currentWordIndex === -1) {
          this.currentWordIndex = this.wordFiles.length - 1;
          // Wait for Angular to render the view before loading the document
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            setTimeout(() => {
              this.loadWord(wordFile);
            }, 50);
          });
        }
      } catch (error) {
        errors.push(`${file.name}: Failed to load document - ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    
    if (!isCurrentlyFullscreen && this.isFullscreenView) {
      // User exited fullscreen externally (e.g., F11 key, Escape)
      this.isFullscreenView = false;
      // Re-render in normal view
      setTimeout(() => {
        this.updateZoom();
      }, 100);
      this.cdr.detectChanges();
    }
  }

  toggleFullscreenView(): void {
    if (this.isFullscreenView) {
      this.exitFullscreenView();
    } else {
      this.enterFullscreenView();
    }
  }

  enterFullscreenView(): void {
    if (!this.currentWord) return;
    
    this.isFullscreenView = true;
    this.cdr.detectChanges();
    
    // Wait for the DOM to update after setting isFullscreenView to true
    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = this.fullscreenContainer?.nativeElement;
        if (!container) {
          console.error('Fullscreen container not found');
          this.isFullscreenView = false;
          this.cdr.detectChanges();
          return;
        }

        // Request fullscreen
        if (container.requestFullscreen) {
          container.requestFullscreen().then(() => {
            // Re-render document in fullscreen after entering
            setTimeout(() => {
              this.renderDocumentInFullscreen();
            }, 150);
          }).catch((err: Error) => {
            console.error('Error attempting to enable fullscreen:', err);
            this.isFullscreenView = false;
            this.cdr.detectChanges();
          });
        } else if ((container as any).webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
          setTimeout(() => {
            this.renderDocumentInFullscreen();
          }, 150);
        } else if ((container as any).mozRequestFullScreen) {
          (container as any).mozRequestFullScreen();
          setTimeout(() => {
            this.renderDocumentInFullscreen();
          }, 150);
        } else if ((container as any).msRequestFullscreen) {
          (container as any).msRequestFullscreen();
          setTimeout(() => {
            this.renderDocumentInFullscreen();
          }, 150);
        } else {
          // Fallback: use fullscreen CSS class
          container.classList.add('fullscreen-active');
          this.isFullscreenView = true;
          setTimeout(() => {
            this.renderDocumentInFullscreen();
          }, 150);
        }
      }, 50);
    });
  }

  exitFullscreenView(): void {
    this.isFullscreenView = false;
    
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
    
    // Remove fallback fullscreen class
    if (this.fullscreenContainer?.nativeElement) {
      this.fullscreenContainer.nativeElement.classList.remove('fullscreen-active');
    }
    
    // Re-render document in normal view
    setTimeout(() => {
      this.updateZoom();
    }, 100);
    
    this.cdr.detectChanges();
  }

  private renderDocumentInFullscreen(): void {
    if (!this.currentWord || !this.fullscreenDocumentContainer?.nativeElement) {
      return;
    }
    
    const container = this.fullscreenDocumentContainer.nativeElement;
    container.innerHTML = this.currentWord.htmlContent || '';
    // Ensure the container can grow to accommodate long content
    container.style.height = 'auto';
    container.style.minHeight = 'auto';
    this.updateZoom();
  }

  async loadWord(wordFile: WordFile): Promise<void> {
    if (!wordFile.htmlContent) {
      this.errorMessage = 'Word document content not available';
      this.cdr.detectChanges();
      return;
    }
    
    // Ensure view is updated so the container exists
    this.cdr.detectChanges();
    
    // Wait for Angular to complete change detection and DOM update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Try to get the container element - use ViewChild first, then querySelector as fallback
    const getContainer = (): HTMLDivElement | null => {
      // Try ViewChild first
      if (this.documentContainer?.nativeElement) {
        return this.documentContainer.nativeElement;
      }
      
      // Fallback: query DOM directly
      const container = document.querySelector('.document-content-wrapper') as HTMLDivElement;
      return container || null;
    };
    
    // Retry mechanism to find the container
    let attempts = 0;
    const maxAttempts = 20;
    
    const tryRender = (): void => {
      attempts++;
      const container = getContainer();
      
      if (container) {
        container.innerHTML = wordFile.htmlContent || '';
        // Apply zoom level
        container.style.zoom = `${this.zoomLevel}%`;
        // Ensure the container can grow to accommodate long content
        container.style.height = 'auto';
        container.style.minHeight = '500px';
        this.cdr.detectChanges();
        return;
      }
      
      if (attempts < maxAttempts) {
        // Force change detection and try again
        this.cdr.detectChanges();
        setTimeout(tryRender, 50);
      } else {
        console.error('Document container not found after multiple attempts');
        this.errorMessage = 'Failed to render document: container not available. Please try uploading again.';
        this.cdr.detectChanges();
      }
    };
    
    tryRender();
  }

  selectWord(index: number): Promise<void> {
    if (index >= 0 && index < this.wordFiles.length) {
      this.currentWordIndex = index;
      return this.loadWord(this.wordFiles[index]);
    }
    return Promise.resolve();
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

  fitToWidth(): void {
    if (!this.currentWord) return;

    // Get the appropriate container based on fullscreen state
    const container = this.isFullscreenView 
      ? this.fullscreenDocumentContainer?.nativeElement 
      : this.documentContainer?.nativeElement;
    
    if (!container) {
      return;
    }

    // Get container width, accounting for padding
    const containerWidth = container.clientWidth - (this.isFullscreenView ? 80 : 100);
    
    if (containerWidth > 0) {
      // For documents, we'll use a simple approach - set zoom to fit width
      // This is a simplified version - in a real scenario, you'd calculate based on content width
      const baseWidth = 900; // Base document width
      const scale = containerWidth / baseWidth;
      this.zoomLevel = Math.max(50, Math.min(200, Math.round(scale * 100))); // Clamp between 50% and 200%
      this.updateZoom();
    }
  }

  updateZoom(): void {
    // Update zoom for both normal and fullscreen containers
    const normalContainer = this.documentContainer?.nativeElement || 
                      document.querySelector('.document-content-wrapper') as HTMLDivElement;
    const fullscreenContainer = this.fullscreenDocumentContainer?.nativeElement;
    
    if (normalContainer) {
      normalContainer.style.zoom = `${this.zoomLevel}%`;
    }
    
    if (fullscreenContainer) {
      fullscreenContainer.style.zoom = `${this.zoomLevel}%`;
    }
    
    this.cdr.detectChanges();
  }

  downloadWord(): void {
    if (!this.currentWord) return;
    
    const link = document.createElement('a');
    link.href = this.currentWord.url;
    link.download = this.currentWord.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  printWord(): void {
    if (!this.currentWord) return;
    
    const printWindow = window.open('', '_blank');
    if (printWindow && this.currentWord.htmlContent) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${this.currentWord.name}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            ${this.currentWord.htmlContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  removeWord(index: number): void {
    if (index >= 0 && index < this.wordFiles.length) {
      const wordFile = this.wordFiles[index];
      
      // Revoke object URL
      if (wordFile.url) {
        URL.revokeObjectURL(wordFile.url);
      }
      
      this.wordFiles.splice(index, 1);
      
      if (this.currentWordIndex === index) {
        if (this.wordFiles.length > 0) {
          this.currentWordIndex = Math.min(index, this.wordFiles.length - 1);
          this.loadWord(this.wordFiles[this.currentWordIndex]);
        } else {
          this.currentWordIndex = -1;
          if (this.documentContainer?.nativeElement) {
            this.documentContainer.nativeElement.innerHTML = '';
          }
        }
      } else if (this.currentWordIndex > index) {
        this.currentWordIndex--;
      }
      
      this.cdr.detectChanges();
    }
  }

  clearAll(): void {
    if (this.isFullscreenView) {
      this.exitFullscreenView();
    }
    
    for (const wordFile of this.wordFiles) {
      if (wordFile.url) {
        URL.revokeObjectURL(wordFile.url);
      }
    }
    
    this.wordFiles = [];
    this.currentWordIndex = -1;
    
    if (this.documentContainer?.nativeElement) {
      this.documentContainer.nativeElement.innerHTML = '';
    }
    
    if (this.fullscreenDocumentContainer?.nativeElement) {
      this.fullscreenDocumentContainer.nativeElement.innerHTML = '';
    }
    
    this.cdr.detectChanges();
  }

  async copyTextContent(): Promise<void> {
    if (!this.currentWord?.textContent) return;
    try {
      await navigator.clipboard.writeText(this.currentWord.textContent);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = this.currentWord.textContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
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

  extractTextFromHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  async convertRtfToHtml(rtfText: string): Promise<string> {
    // Basic RTF to HTML conversion
    // Remove RTF control words and convert to HTML
    let html = rtfText;
    
    // Remove RTF header
    html = html.replace(/\{[^}]*\\rtf[^}]*\}/gi, '');
    
    // Convert line breaks
    html = html.replace(/\\par\s*/gi, '<br>');
    html = html.replace(/\\line\s*/gi, '<br>');
    
    // Remove RTF control words
    html = html.replace(/\\[a-z]+\d*\s*/gi, '');
    html = html.replace(/\\[a-z]+\s*/gi, '');
    
    // Remove braces
    html = html.replace(/[{}]/g, '');
    
    // Preserve whitespace
    html = html.replace(/\n\s*\n/g, '<p></p>');
    
    return `<div class="rtf-content">${this.escapeHtml(html)}</div>`;
  }

  extractRtfText(rtfText: string): string {
    // Extract plain text from RTF
    let text = rtfText;
    // Remove RTF control words
    text = text.replace(/\\[a-z]+\d*\s*/gi, ' ');
    text = text.replace(/\\[a-z]+\s*/gi, ' ');
    // Remove braces
    text = text.replace(/[{}]/g, '');
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }

  getDocumentTypeLabel(type: DocumentType): string {
    switch (type) {
      case DocumentType.DOCX: return 'DOCX';
      case DocumentType.DOC: return 'DOC';
      case DocumentType.RTF: return 'RTF';
      case DocumentType.ODT: return 'ODT';
      case DocumentType.TXT: return 'TXT';
      case DocumentType.HTML: return 'HTML';
      default: return 'Unknown';
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    // Don't handle keyboard shortcuts if user is typing in an input
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if (e.key === 'Escape' && this.isFullscreenView) {
      this.exitFullscreenView();
    }
  }

  cleanup(): void {
    if (this.isFullscreenView) {
      this.exitFullscreenView();
    }
    
    // Cleanup drag and drop
    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }
    
    // Cleanup fullscreen listeners
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    for (const eventName of events) {
      document.removeEventListener(eventName, this.fullscreenChangeHandler);
    }
    
    // Cleanup Word files
    this.clearAll();
  }
}

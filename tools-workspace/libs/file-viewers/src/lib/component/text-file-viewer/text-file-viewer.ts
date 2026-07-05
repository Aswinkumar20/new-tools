import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

// File type detection
enum TextFileType {
  TXT = 'txt',
  LOG = 'log',
  MD = 'md',
  JSON = 'json',
  XML = 'xml',
  YAML = 'yaml',
  YML = 'yml',
  INI = 'ini',
  CFG = 'cfg',
  CONFIG = 'config',
  CSV = 'csv',
  RTF = 'rtf',
  HTML = 'html',
  HTM = 'htm',
  CSS = 'css',
  JS = 'js',
  TS = 'ts',
  PY = 'py',
  SH = 'sh',
  BAT = 'bat',
  PS1 = 'ps1',
  UNSUPPORTED = 'unsupported'
}

function detectTextFileType(file: File): TextFileType {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  // Check extension first
  if (fileName.endsWith('.txt') || mimeType === 'text/plain') {
    return TextFileType.TXT;
  }
  if (fileName.endsWith('.log')) {
    return TextFileType.LOG;
  }
  if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) {
    return TextFileType.MD;
  }
  if (fileName.endsWith('.json') || mimeType === 'application/json') {
    return TextFileType.JSON;
  }
  if (fileName.endsWith('.xml') || mimeType === 'application/xml' || mimeType === 'text/xml') {
    return TextFileType.XML;
  }
  if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
    return TextFileType.YAML;
  }
  if (fileName.endsWith('.ini') || fileName.endsWith('.cfg') || fileName.endsWith('.config')) {
    return TextFileType.INI;
  }
  if (fileName.endsWith('.csv') || mimeType === 'text/csv') {
    return TextFileType.CSV;
  }
  if (fileName.endsWith('.rtf') || mimeType === 'application/rtf' || mimeType === 'text/rtf') {
    return TextFileType.RTF;
  }
  if (fileName.endsWith('.html') || fileName.endsWith('.htm') || mimeType === 'text/html') {
    return TextFileType.HTML;
  }
  if (fileName.endsWith('.css') || mimeType === 'text/css') {
    return TextFileType.CSS;
  }
  if (fileName.endsWith('.js') || mimeType === 'application/javascript' || mimeType === 'text/javascript') {
    return TextFileType.JS;
  }
  if (fileName.endsWith('.ts') || mimeType === 'application/typescript') {
    return TextFileType.TS;
  }
  if (fileName.endsWith('.py') || mimeType === 'text/x-python') {
    return TextFileType.PY;
  }
  if (fileName.endsWith('.sh') || mimeType === 'application/x-sh') {
    return TextFileType.SH;
  }
  if (fileName.endsWith('.bat') || fileName.endsWith('.cmd')) {
    return TextFileType.BAT;
  }
  if (fileName.endsWith('.ps1')) {
    return TextFileType.PS1;
  }

  // If no extension matches but it's a text MIME type, treat as TXT
  if (mimeType.startsWith('text/')) {
    return TextFileType.TXT;
  }

  return TextFileType.UNSUPPORTED;
}

interface TextFile {
  name: string;
  file: File;
  url: string;
  size: number;
  content: string;
  lines: number;
  fileType: TextFileType;
  encoding: string;
}

@Component({
  selector: 'lib-text-file-viewer',
  standalone: true,
  templateUrl: './text-file-viewer.html',
  styleUrls: ['./text-file-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective]
})
export class TextFileViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('textContent') textContent!: ElementRef<HTMLPreElement>;
  @ViewChild('fullscreenContainer') fullscreenContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenTextContent') fullscreenTextContent!: ElementRef<HTMLPreElement>;
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  textFiles: TextFile[] = [];
  currentFileIndex: number = -1;
  loading: boolean = false;
  errorMessage: string = '';
  showDropZone: boolean = false;
  isFullscreen: boolean = false;
  zoomLevel: number = 100;
  wordWrap: boolean = true;
  showLineNumbers: boolean = true;
  searchText: string = '';
  searchCaseSensitive: boolean = false;
  searchResults: number[] = [];
  currentSearchIndex: number = -1;

  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private readonly fullscreenChangeHandler = () => this.onFullscreenChange();

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.setupDragAndDrop();
    this.setupFullscreenListeners();
  }

  ngAfterViewInit(): void {
    // Component initialized
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.isFullscreen) {
      this.exitFullscreen();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'g' && this.searchText) {
      e.preventDefault();
      this.findNext();
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G' && this.searchText) {
      e.preventDefault();
      this.findPrevious();
    }
  }

  get currentFile(): TextFile | null {
    return this.currentFileIndex >= 0 && this.currentFileIndex < this.textFiles.length
      ? this.textFiles[this.currentFileIndex]
      : null;
  }

  get loadedFilesCount(): number {
    return this.textFiles.length;
  }

  get currentLineCount(): number {
    return this.currentFile?.lines ?? 0;
  }

  get searchResultsCount(): number {
    return this.searchResults.length;
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

    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const fileType = detectTextFileType(file);

      if (fileType === TextFileType.UNSUPPORTED) {
        // Try to read as text anyway - many text files might not have proper MIME types
        // We'll attempt to read it and if it fails, show an error
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit for text files
        errors.push(`${file.name}: File too large (max 10MB)`);
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
        const fileType = detectTextFileType(file);
        
        // Try to read as text
        let content = '';
        let encoding = 'UTF-8';

        try {
          // Try UTF-8 first
          content = await file.text();
          encoding = 'UTF-8';
        } catch (error) {
          // If UTF-8 fails, try reading as ArrayBuffer and decode
          try {
            const arrayBuffer = await file.arrayBuffer();
            const decoder = new TextDecoder('utf-8', { fatal: false });
            content = decoder.decode(arrayBuffer);
            encoding = 'UTF-8';
          } catch (err) {
            errors.push(`${file.name}: Failed to read file - ${err instanceof Error ? err.message : 'Unknown error'}`);
            continue;
          }
        }

        // Count lines
        const lines = content.split('\n').length;

        const textFile: TextFile = {
          name: file.name,
          file: file,
          url: url,
          size: file.size,
          content: content,
          lines: lines,
          fileType: fileType,
          encoding: encoding
        };

        this.textFiles.push(textFile);

        // Wait for Angular to update the view
        this.cdr.detectChanges();

        if (this.currentFileIndex === -1) {
          this.currentFileIndex = this.textFiles.length - 1;
          // Wait for Angular to render the view before loading
          requestAnimationFrame(() => {
            setTimeout(() => {
              this.loadFile(textFile);
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
  }

  async loadFile(textFile: TextFile): Promise<void> {
    try {
      if (!textFile || !textFile.content) {
        this.errorMessage = 'File content not available';
        this.loading = false;
        this.cdr.detectChanges();
        return;
      }

      // Clear any previous error
      this.errorMessage = '';
      
      // Force change detection first
      this.cdr.detectChanges();

      // Wait for Angular to update the view
      await new Promise(resolve => setTimeout(resolve, 100));

      const getContainer = (): HTMLPreElement | null => {
        if (this.isFullscreen && this.fullscreenTextContent?.nativeElement) {
          return this.fullscreenTextContent.nativeElement;
        }
        if (this.textContent?.nativeElement) {
          return this.textContent.nativeElement;
        }
        return document.querySelector('.text-content') as HTMLPreElement;
      };

      let attempts = 0;
      const maxAttempts = 30;
      let renderComplete = false;

      const tryRender = (): void => {
        attempts++;
        const container = getContainer();

        if (container) {
          // Clear previous content first
          container.innerHTML = '';
          
          // Format and set new content
          const formattedContent = this.formatContent(textFile.content, textFile.fileType);
          container.innerHTML = formattedContent;
          
          // Apply styles and settings
          this.applyStyles(container);
          this.updateZoom(container);
          
          // Clear search highlights first, then apply new ones if needed
          this.highlightSearch(container);
          
          // Force change detection
          this.cdr.detectChanges();
          
          // Scroll to top
          container.scrollTop = 0;
          
          // Mark as complete
          renderComplete = true;
          this.loading = false;
          this.cdr.detectChanges();
          
          return;
        }

        if (attempts < maxAttempts) {
          // Force change detection and try again
          this.cdr.detectChanges();
          setTimeout(tryRender, 50);
        } else {
          console.error('Text container not found after multiple attempts');
          this.errorMessage = 'Failed to render file: container not available. Please try uploading again.';
          this.loading = false;
          this.cdr.detectChanges();
        }
      };

      tryRender();
      
      // Fallback: ensure loading is set to false if render completes quickly
      if (renderComplete) {
        // Already handled in tryRender
      } else {
        // Wait a bit more for render to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!renderComplete) {
          this.loading = false;
          this.cdr.detectChanges();
        }
      }
    } catch (error) {
      console.error('Error loading file:', error);
      this.errorMessage = `Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  formatContent(content: string, fileType: TextFileType): string {
    // First apply syntax highlighting
    let highlightedContent = this.highlightSyntax(content, fileType);
    
    // Then add line numbers if needed
    if (this.showLineNumbers) {
      const lines = highlightedContent.split('\n');
      const formattedLines = lines.map((line, index) => {
        const lineNumber = (index + 1).toString().padStart(lines.length.toString().length, ' ');
        return `<span class="line-number">${lineNumber}</span><span class="line-content">${line}</span>`;
      });
      return formattedLines.join('\n');
    } else {
      return highlightedContent;
    }
  }

  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  highlightSyntax(content: string, fileType: TextFileType): string {
    switch (fileType) {
      case TextFileType.JSON:
        return this.highlightJSON(content);
      case TextFileType.XML:
        return this.highlightXML(content);
      case TextFileType.YAML:
      case TextFileType.YML:
        return this.highlightYAML(content);
      case TextFileType.HTML:
        return this.highlightHTML(content);
      case TextFileType.CSS:
        return this.highlightCSS(content);
      case TextFileType.JS:
      case TextFileType.TS:
        return this.highlightJS(content);
      default:
        return this.escapeHtml(content);
    }
  }

  highlightJSON(content: string): string {
    try {
      const parsed = JSON.parse(content);
      const formatted = JSON.stringify(parsed, null, 2);
      let html = this.escapeHtml(formatted);
      
      // Basic JSON syntax highlighting
      html = html.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
        let cls = 'json-value';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        } else if (/^\d/.test(match)) {
          cls = 'json-number';
        }
        return `<span class="${cls}">${match}</span>`;
      });
      
      return html;
    } catch (error) {
      return this.escapeHtml(content);
    }
  }

  highlightXML(content: string): string {
    let html = this.escapeHtml(content);
    
    // XML syntax highlighting
    html = html.replace(/&lt;(\/?)([\w\-\:]+)([^&]*?)(\/?)&gt;/g, (match, closing, tagName, attrs, selfClosing) => {
      const attrsHighlighted = attrs.replace(/(\w+)=("([^"]*)")/g, '<span class="xml-attr-name">$1</span>=<span class="xml-attr-value">"$3"</span>');
      const cls = closing ? 'xml-tag-closing' : (selfClosing ? 'xml-tag-self-closing' : 'xml-tag-opening');
      return `&lt;${closing}<span class="${cls}">${tagName}</span>${attrsHighlighted}${selfClosing}&gt;`;
    });
    
    return html;
  }

  highlightYAML(content: string): string {
    let html = this.escapeHtml(content);
    
    // Basic YAML syntax highlighting
    html = html.replace(/^(\s*)([^:]+):(\s*)(.*)$/gm, (match, indent, key, space, value) => {
      const valueHighlighted = value.replace(/^(["'])(.*)\1$/, '<span class="yaml-string">$1$2$1</span>')
        .replace(/^\d+(\.\d+)?$/, '<span class="yaml-number">$&</span>')
        .replace(/^(true|false|null)$/i, '<span class="yaml-boolean">$&</span>');
      return `${indent}<span class="yaml-key">${key}</span>:${space}${valueHighlighted}`;
    });
    
    return html;
  }

  highlightHTML(content: string): string {
    return this.highlightXML(content); // HTML uses similar highlighting to XML
  }

  highlightCSS(content: string): string {
    let html = this.escapeHtml(content);
    
    // Basic CSS syntax highlighting
    html = html.replace(/([.#][\w-]+)\s*\{/g, '<span class="css-selector">$1</span> {')
      .replace(/([\w-]+)\s*:/g, '<span class="css-property">$1</span>:')
      .replace(/:([^;]+);/g, ': <span class="css-value">$1</span>;');
    
    return html;
  }

  highlightJS(content: string): string {
    let html = this.escapeHtml(content);
    
    // Basic JavaScript syntax highlighting
    const keywords = ['function', 'var', 'let', 'const', 'if', 'else', 'for', 'while', 'return', 'class', 'import', 'export', 'async', 'await', 'try', 'catch', 'finally'];
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      html = html.replace(regex, `<span class="js-keyword">${keyword}</span>`);
    });
    
    html = html.replace(/("(\\"|[^"])*"|'(\\'|[^'])*')/g, '<span class="js-string">$&</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="js-number">$1</span>')
      .replace(/\/\/.*$/gm, '<span class="js-comment">$&</span>')
      .replace(/\/\*[\s\S]*?\*\//g, '<span class="js-comment">$&</span>');
    
    return html;
  }

  applyStyles(container: HTMLPreElement): void {
    if (this.wordWrap) {
      container.classList.add('word-wrap');
    } else {
      container.classList.remove('word-wrap');
    }

    if (this.showLineNumbers) {
      container.classList.add('show-line-numbers');
    } else {
      container.classList.remove('show-line-numbers');
    }
  }

  async selectFile(index: number): Promise<void> {
    if (index >= 0 && index < this.textFiles.length) {
      // Prevent switching if already loading
      if (this.loading) {
        return;
      }

      this.currentFileIndex = index;
      this.searchText = '';
      this.searchResults = [];
      this.currentSearchIndex = -1;
      
      // Show loading indicator
      this.loading = true;
      this.errorMessage = '';
      
      // Force change detection first
      this.cdr.detectChanges();
      
      // Wait for Angular to update the view before loading
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Load the file
      await this.loadFile(this.textFiles[index]);
      
      // Hide loading indicator (will be set to false in loadFile after rendering)
    }
  }

  removeFile(index: number): void {
    if (index >= 0 && index < this.textFiles.length) {
      const removedFile = this.textFiles.splice(index, 1)[0];
      URL.revokeObjectURL(removedFile.url);

      if (this.textFiles.length === 0) {
        this.currentFileIndex = -1;
        if (this.textContent?.nativeElement) {
          this.textContent.nativeElement.innerHTML = '';
        }
      } else if (index === this.currentFileIndex) {
        this.currentFileIndex = Math.min(index, this.textFiles.length - 1);
        this.loadFile(this.textFiles[this.currentFileIndex]);
      } else if (index < this.currentFileIndex) {
        this.currentFileIndex--;
      }
      this.cdr.detectChanges();
    }
  }

  clearAll(): void {
    this.textFiles.forEach(file => URL.revokeObjectURL(file.url));
    this.textFiles = [];
    this.currentFileIndex = -1;
    this.loading = false;
    this.errorMessage = '';
    this.searchText = '';
    this.searchResults = [];
    this.currentSearchIndex = -1;
    if (this.textContent?.nativeElement) {
      this.textContent.nativeElement.innerHTML = '';
    }
    this.cdr.detectChanges();
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

  async copyToClipboard(): Promise<void> {
    if (!this.currentFile) return;

    try {
      await navigator.clipboard.writeText(this.currentFile.content);
      // Show success feedback (you could add a toast notification here)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      this.errorMessage = 'Failed to copy to clipboard';
      this.cdr.detectChanges();
    }
  }

  printFile(): void {
    if (!this.currentFile) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${this.currentFile.name}</title>
            <style>
              body { font-family: 'Courier New', monospace; margin: 20px; font-size: 12px; }
              pre { white-space: pre-wrap; word-wrap: break-word; }
            </style>
          </head>
          <body>
            <pre>${this.escapeHtml(this.currentFile.content)}</pre>
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

  toggleWordWrap(): void {
    this.wordWrap = !this.wordWrap;
    if (this.currentFile) {
      this.loadFile(this.currentFile);
    }
  }

  toggleLineNumbers(): void {
    this.showLineNumbers = !this.showLineNumbers;
    if (this.currentFile) {
      this.loadFile(this.currentFile);
    }
  }

  getFileTypeLabel(type: TextFileType): string {
    return type.toUpperCase();
  }

  onSearchChange(): void {
    if (!this.currentFile) return;
    
    const container = this.isFullscreen 
      ? this.fullscreenTextContent?.nativeElement 
      : this.textContent?.nativeElement;
    
    if (container) {
      this.highlightSearch(container);
    }
  }

  highlightSearch(container: HTMLPreElement): void {
    if (!this.searchText || !this.currentFile) {
      // Remove all highlights
      container.querySelectorAll('.search-highlight').forEach(el => {
        el.classList.remove('search-highlight', 'search-highlight-active');
      });
      return;
    }

    // Remove existing highlights
    container.querySelectorAll('.search-highlight').forEach(el => {
      const text = document.createTextNode(el.textContent || '');
      el.parentNode?.replaceChild(text, el);
    });

    // Get text content
    const text = container.textContent || '';
    const regex = new RegExp(
      this.escapeRegex(this.searchText),
      this.searchCaseSensitive ? 'g' : 'gi'
    );

    this.searchResults = [];
    let match;
    const regex2 = new RegExp(
      this.escapeRegex(this.searchText),
      this.searchCaseSensitive ? 'g' : 'gi'
    );
    while ((match = regex2.exec(text)) !== null) {
      this.searchResults.push(match.index);
    }

    if (this.searchResults.length > 0) {
      this.currentSearchIndex = this.currentSearchIndex >= 0 ? this.currentSearchIndex : 0;
      this.scrollToSearchResult();
    } else {
      this.currentSearchIndex = -1;
    }

    this.cdr.detectChanges();
  }

  escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  findNext(): void {
    if (this.searchResults.length === 0) {
      this.onSearchChange();
      return;
    }

    this.currentSearchIndex = (this.currentSearchIndex + 1) % this.searchResults.length;
    this.scrollToSearchResult();
  }

  findPrevious(): void {
    if (this.searchResults.length === 0) {
      this.onSearchChange();
      return;
    }

    this.currentSearchIndex = this.currentSearchIndex <= 0 
      ? this.searchResults.length - 1 
      : this.currentSearchIndex - 1;
    this.scrollToSearchResult();
  }

  scrollToSearchResult(): void {
    // This is a simplified version - in a real implementation, you'd need to
    // track the actual DOM positions of search results
    const container = this.isFullscreen 
      ? this.fullscreenTextContent?.nativeElement 
      : this.textContent?.nativeElement;
    
    if (container && this.currentSearchIndex >= 0) {
      container.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  updateZoom(container?: HTMLPreElement): void {
    const targetContainer = container || (this.isFullscreen 
      ? this.fullscreenTextContent?.nativeElement 
      : (this.textContent?.nativeElement || document.querySelector('.text-content') as HTMLPreElement));
    
    if (targetContainer) {
      targetContainer.style.fontSize = `${this.zoomLevel}%`;
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
          console.error('Fullscreen container not found');
          this.isFullscreen = false;
          this.cdr.detectChanges();
          return;
        }

        const requestFullscreen = () => {
          if (container.requestFullscreen) {
            container.requestFullscreen().then(() => {
              // Re-render content after entering fullscreen
              setTimeout(() => {
                if (this.currentFile) {
                  this.loadFile(this.currentFile);
                }
              }, 150);
            }).catch((err: Error) => {
              console.error('Error attempting to enable fullscreen:', err);
              this.isFullscreen = false;
              this.cdr.detectChanges();
            });
          } else if ((container as any).webkitRequestFullscreen) {
            (container as any).webkitRequestFullscreen();
            setTimeout(() => {
              if (this.currentFile) {
                this.loadFile(this.currentFile);
              }
            }, 150);
          } else if ((container as any).mozRequestFullScreen) {
            (container as any).mozRequestFullScreen();
            setTimeout(() => {
              if (this.currentFile) {
                this.loadFile(this.currentFile);
              }
            }, 150);
          } else if ((container as any).msRequestFullscreen) {
            (container as any).msRequestFullscreen();
            setTimeout(() => {
              if (this.currentFile) {
                this.loadFile(this.currentFile);
              }
            }, 150);
          } else {
            container.classList.add('fullscreen-active');
            this.isFullscreen = true;
            setTimeout(() => {
              if (this.currentFile) {
                this.loadFile(this.currentFile);
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

    // Re-render content in normal view after exiting fullscreen
    setTimeout(() => {
      if (this.currentFile) {
        this.loadFile(this.currentFile);
      }
      this.cdr.detectChanges();
    }, 150);
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
    this.textFiles.forEach(file => URL.revokeObjectURL(file.url));
  }
}

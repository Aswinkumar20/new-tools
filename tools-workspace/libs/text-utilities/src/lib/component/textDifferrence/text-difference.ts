import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, inject } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { Subject } from 'rxjs';

@Component({
  selector: 'lib-text-difference',
  standalone: true,
  templateUrl: './text-difference.html',
  styleUrls: ['./text-difference.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, MonacoEditorModule, TooltipDirective],
})
export class TextDifferenceComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  themes = ['vs-dark', 'vs-light', 'hc-black'];
  languages = [
    'typescript', 
    'javascript', 
    'json', 
    'html', 
    'css', 
    'markdown',
    'python',
    'java',
    'xml',
    'yaml',
    'plaintext'
  ];

  editorOptions = {
    theme: this.themes[0],
    language: this.languages[0],
    readOnly: false,
    originalEditable: true,
    fontSize: 14,
    minimap: { enabled: typeof window !== 'undefined' && window.innerWidth > 768 },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: 'on' as const,
    renderSideBySide: typeof window !== 'undefined' && window.innerWidth > 768,
    enableSplitViewResizing: true,
    ignoreTrimWhitespace: false,
    renderIndicators: true,
    diffWordWrap: 'on' as const,
    padding: { top: 12, bottom: 12 },
    cursorBlinking: 'blink' as const,
    cursorSmoothCaretAnimation: 'on' as const,
    cursorStyle: 'line' as const,
    cursorWidth: 2,
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
    },
  };

  originalModel = {
    code: 'heLLo world!\nThis is the original text.',
    language: this.languages[0],
  };

  modifiedModel = {
    code: 'hello world!\nThis is the modified text.',
    language: this.languages[0],
  };

  private editor: any;
  private readonly destroy$ = new Subject<void>();
  private resizeObserver?: ResizeObserver;
  private windowResizeListener?: () => void;
  private isMobile = false;

  @ViewChild('editorContainer', { static: false }) editorContainer?: ElementRef<HTMLElement>;

  ngOnInit() {
    // Initialize with empty content if needed
    if (!this.originalModel.code.trim()) {
      this.originalModel.code = '';
    }
    if (!this.modifiedModel.code.trim()) {
      this.modifiedModel.code = '';
    }
    
    // Check initial screen size
    this.updateEditorLayoutForScreenSize();
  }
  
  private updateEditorLayoutForScreenSize() {
    if (typeof window === 'undefined') return;
    
    const width = window.innerWidth;
    const shouldBeInline = width <= 768; // Stack vertically on mobile/tablet
    
    if (this.isMobile !== shouldBeInline) {
      this.isMobile = shouldBeInline;
      this.editorOptions = {
        ...this.editorOptions,
        renderSideBySide: !shouldBeInline, // false = inline (stacked), true = side-by-side
        minimap: { enabled: !shouldBeInline }, // Disable minimap on mobile for better space
      };
      
      // Update editor if it exists
      if (this.editor) {
        try {
          this.editor.updateOptions({
            renderSideBySide: !shouldBeInline,
            minimap: { enabled: !shouldBeInline }
          });
          // Trigger layout update
          setTimeout(() => {
            const modifiedEditor = this.editor?.getModifiedEditor();
            const originalEditor = this.editor?.getOriginalEditor();
            if (modifiedEditor && originalEditor) {
              modifiedEditor.layout();
              originalEditor.layout();
            }
          }, 100);
        } catch (e) {
          console.warn('Error updating editor layout:', e);
        }
      }
    }
  }

  ngAfterViewInit() {
    // Setup resize observer for automatic layout
    if (this.editorContainer && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        if (this.editor?.getModifiedEditor && this.editor?.getOriginalEditor) {
          // Use requestAnimationFrame for smoother updates
          requestAnimationFrame(() => {
            try {
              const modifiedEditor = this.editor.getModifiedEditor();
              const originalEditor = this.editor.getOriginalEditor();
              
              if (modifiedEditor && originalEditor) {
                // Preserve scroll positions before layout
                const modifiedScrollTop = modifiedEditor.getScrollTop();
                const modifiedScrollLeft = modifiedEditor.getScrollLeft();
                const originalScrollTop = originalEditor.getScrollTop();
                const originalScrollLeft = originalEditor.getScrollLeft();
                
                // Get container dimensions using getBoundingClientRect for accuracy
                const container = entries[0]?.target as HTMLElement;
                if (container) {
                  const rect = container.getBoundingClientRect();
                  const width = rect.width || container.clientWidth;
                  const height = rect.height || container.clientHeight;
                  
                  if (width > 0 && height > 0) {
                    // Determine layout based on screen size
                    if (this.isMobile) {
                      // Inline mode: full width, split height exactly
                      const editorHeight = Math.floor(height / 2);
                      modifiedEditor.layout({ width: Math.floor(width), height: editorHeight });
                      originalEditor.layout({ width: Math.floor(width), height: editorHeight });
                    } else {
                      // Side-by-side mode: split width exactly, full height
                      const editorWidth = Math.floor(width / 2);
                      modifiedEditor.layout({ width: editorWidth, height: Math.floor(height) });
                      originalEditor.layout({ width: editorWidth, height: Math.floor(height) });
                    }
                  } else {
                    // Fallback to automatic layout
                    modifiedEditor.layout();
                    originalEditor.layout();
                  }
                  
                  // Restore scroll positions after layout
                  requestAnimationFrame(() => {
                    modifiedEditor.setScrollTop(modifiedScrollTop);
                    modifiedEditor.setScrollLeft(modifiedScrollLeft);
                    originalEditor.setScrollTop(originalScrollTop);
                    originalEditor.setScrollLeft(originalScrollLeft);
                  });
                } else {
                  // Fallback to automatic layout
                  modifiedEditor.layout();
                  originalEditor.layout();
                }
              }
            } catch (e) {
              console.warn('Error resizing editor:', e);
            }
          });
        }
      });
      this.resizeObserver.observe(this.editorContainer.nativeElement);
    }
    
    // Also listen to window resize as fallback
    if (typeof window !== 'undefined') {
      this.windowResizeListener = () => {
        this.handleWindowResize();
        this.updateEditorLayoutForScreenSize();
      };
      window.addEventListener('resize', this.windowResizeListener);
    }
  }
  
  private handleWindowResize = () => {
    if (this.editor?.getModifiedEditor && this.editor?.getOriginalEditor) {
      // Debounce resize events
      clearTimeout((this as any).resizeTimeout);
      (this as any).resizeTimeout = setTimeout(() => {
        try {
          const modifiedEditor = this.editor.getModifiedEditor();
          const originalEditor = this.editor.getOriginalEditor();
          
          if (modifiedEditor && originalEditor) {
            // Preserve scroll positions before layout
            const modifiedScrollTop = modifiedEditor.getScrollTop();
            const modifiedScrollLeft = modifiedEditor.getScrollLeft();
            const originalScrollTop = originalEditor.getScrollTop();
            const originalScrollLeft = originalEditor.getScrollLeft();
            
            // For inline mode (mobile), each editor gets full width and half height
            // For side-by-side mode, each gets half width and full height
            if (this.editorContainer) {
              const container = this.editorContainer.nativeElement;
              const rect = container.getBoundingClientRect();
              const width = rect.width || container.clientWidth || container.offsetWidth;
              const height = rect.height || container.clientHeight || container.offsetHeight;
              
              if (width > 0 && height > 0) {
                if (this.isMobile) {
                  // Inline mode: full width, split height exactly
                  const editorHeight = Math.floor(height / 2);
                  modifiedEditor.layout({ width: Math.floor(width), height: editorHeight });
                  originalEditor.layout({ width: Math.floor(width), height: editorHeight });
                } else {
                  // Side-by-side mode: split width exactly, full height
                  const editorWidth = Math.floor(width / 2);
                  modifiedEditor.layout({ width: editorWidth, height: Math.floor(height) });
                  originalEditor.layout({ width: editorWidth, height: Math.floor(height) });
                }
              } else {
                modifiedEditor.layout();
                originalEditor.layout();
              }
              
              // Restore scroll positions after layout
              requestAnimationFrame(() => {
                modifiedEditor.setScrollTop(modifiedScrollTop);
                modifiedEditor.setScrollLeft(modifiedScrollLeft);
                originalEditor.setScrollTop(originalScrollTop);
                originalEditor.setScrollLeft(originalScrollLeft);
              });
            } else {
              modifiedEditor.layout();
              originalEditor.layout();
            }
          }
        } catch (e) {
          console.warn('Error resizing editor on window resize:', e);
        }
      }, 150);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (typeof window !== 'undefined' && this.windowResizeListener) {
      window.removeEventListener('resize', this.windowResizeListener);
    }
    if ((this as any).resizeTimeout) {
      clearTimeout((this as any).resizeTimeout);
    }
    // Clear content change timeouts
    if ((this as any).modifiedContentTimeout) {
      clearTimeout((this as any).modifiedContentTimeout);
    }
    if ((this as any).originalContentTimeout) {
      clearTimeout((this as any).originalContentTimeout);
    }
  }

  onEditorInit(editor: any) {
    this.editor = editor;
    
    if (editor) {
      try {
        // Ensure editor is properly initialized
        const modifiedEditor = editor.getModifiedEditor();
        const originalEditor = editor.getOriginalEditor();
        
        if (modifiedEditor && originalEditor) {
          // Trigger initial layout with proper dimensions - use multiple attempts for reliability
          const performLayout = () => {
            try {
              // Get container dimensions if available
              if (this.editorContainer) {
                const container = this.editorContainer.nativeElement;
                // Use getBoundingClientRect for accurate dimensions
                const rect = container.getBoundingClientRect();
                const width = rect.width || container.clientWidth || container.offsetWidth;
                const height = rect.height || container.clientHeight || container.offsetHeight;
                
                if (width > 0 && height > 0) {
                  if (this.isMobile) {
                    // Inline mode: full width, split height exactly
                    const editorHeight = Math.floor(height / 2);
                    modifiedEditor.layout({ width: Math.floor(width), height: editorHeight });
                    originalEditor.layout({ width: Math.floor(width), height: editorHeight });
                  } else {
                    // Side-by-side mode: split width exactly, full height
                    const editorWidth = Math.floor(width / 2);
                    modifiedEditor.layout({ width: editorWidth, height: Math.floor(height) });
                    originalEditor.layout({ width: editorWidth, height: Math.floor(height) });
                  }
                } else {
                  // Fallback: wait a bit and try again
                  setTimeout(() => {
                    const retryRect = container.getBoundingClientRect();
                    const retryWidth = retryRect.width || container.clientWidth;
                    const retryHeight = retryRect.height || container.clientHeight;
                    if (retryWidth > 0 && retryHeight > 0) {
                      if (this.isMobile) {
                        const editorHeight = Math.floor(retryHeight / 2);
                        modifiedEditor.layout({ width: Math.floor(retryWidth), height: editorHeight });
                        originalEditor.layout({ width: Math.floor(retryWidth), height: editorHeight });
                      } else {
                        const editorWidth = Math.floor(retryWidth / 2);
                        modifiedEditor.layout({ width: editorWidth, height: Math.floor(retryHeight) });
                        originalEditor.layout({ width: editorWidth, height: Math.floor(retryHeight) });
                      }
                    } else {
                      modifiedEditor.layout();
                      originalEditor.layout();
                    }
                  }, 100);
                }
              } else {
                modifiedEditor.layout();
                originalEditor.layout();
              }
            } catch (e) {
              console.warn('Error in editor layout:', e);
            }
          };
          
          // Initial layout with delay to ensure DOM is ready
          // Only do initial layout, don't repeatedly call it
          requestAnimationFrame(() => {
            performLayout();
          });

          // Don't sync content changes during typing to prevent scroll jumps
          // The editor manages its own content, and we'll only sync when needed
          // (e.g., when switching languages or clearing content)
          // This prevents the editor from re-rendering and losing scroll position
          
          // Store layout function for manual triggers
          (this as any).performLayout = performLayout;
        }
      } catch (error) {
        console.error('Error initializing editor:', error);
      }
    }
  }

  updateOriginalContent(content: string) {
    // Direct assignment to avoid creating new object reference
    // This prevents Angular from thinking the model changed and re-rendering
    if (this.originalModel.code !== content) {
      this.originalModel.code = content;
    }
  }

  updateModifiedContent(content: string) {
    // Direct assignment to avoid creating new object reference
    // This prevents Angular from thinking the model changed and re-rendering
    if (this.modifiedModel.code !== content) {
      this.modifiedModel.code = content;
    }
  }

  onThemeChange(theme: string) {
    this.editorOptions = { ...this.editorOptions, theme };
    if (this.editor) {
      try {
        this.editor.updateOptions({ theme });
      } catch (e) {
        console.warn('Error updating theme:', e);
      }
    }
  }

  onLanguageChange(language: string) {
    const normalizedLang = language === 'text/plain' ? 'plaintext' : language;
    this.editorOptions = { ...this.editorOptions, language: normalizedLang };
    
    // Update models with new language
    this.originalModel = { 
      ...this.originalModel, 
      language: normalizedLang 
    };
    this.modifiedModel = { 
      ...this.modifiedModel, 
      language: normalizedLang 
    };

    // Update editor models if available
    if (this.editor) {
      try {
        const modifiedEditor = this.editor.getModifiedEditor();
        const originalEditor = this.editor.getOriginalEditor();
        
        if (modifiedEditor && originalEditor) {
          // Monaco editor will handle model updates automatically via binding
          // But we can trigger a refresh
          setTimeout(() => {
            modifiedEditor.layout();
            originalEditor.layout();
          }, 50);
        }
      } catch (e) {
        console.warn('Error updating language:', e);
      }
    }
  }

  onFontSizeChange(fontSize: number) {
    if (fontSize >= 8 && fontSize <= 32) {
      this.editorOptions = { ...this.editorOptions, fontSize };
      if (this.editor) {
        try {
          this.editor.updateOptions({ fontSize });
        } catch (e) {
          console.warn('Error updating font size:', e);
        }
      }
    }
  }

  clearOriginal() {
    this.originalModel = { ...this.originalModel, code: '' };
    // Sync with editor if available
    if (this.editor?.getOriginalEditor) {
      try {
        const originalEditor = this.editor.getOriginalEditor();
        if (originalEditor) {
          originalEditor.setValue('');
        }
      } catch (e) {
        console.warn('Error clearing original editor:', e);
      }
    }
  }

  clearModified() {
    this.modifiedModel = { ...this.modifiedModel, code: '' };
    // Sync with editor if available
    if (this.editor?.getModifiedEditor) {
      try {
        const modifiedEditor = this.editor.getModifiedEditor();
        if (modifiedEditor) {
          modifiedEditor.setValue('');
        }
      } catch (e) {
        console.warn('Error clearing modified editor:', e);
      }
    }
  }

  clearAll() {
    this.clearOriginal();
    this.clearModified();
  }

  get diffStats() {
    const original = this.originalModel.code || '';
    const modified = this.modifiedModel.code || '';

    return {
      originalLines: original ? original.split('\n').length : 0,
      modifiedLines: modified ? modified.split('\n').length : 0,
      originalChars: original.length,
      modifiedChars: modified.length,
      hasContent: original.length > 0 || modified.length > 0,
    };
  }

  copyOriginal(): void {
    this.copyText(this.originalModel.code, 'Original');
  }

  copyModified(): void {
    this.copyText(this.modifiedModel.code, 'Modified');
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }
}
import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

interface TextExtractionResult {
  text: string;
  confidence: number;
  words: number;
  characters: number;
  lines: number;
  previewUrl: SafeUrl;
  filename: string | null;
  processingTime: number;
}

interface HistoryEntry {
  timestamp: number;
  filename: string | null;
  text: string;
  words: number;
  preview: string;
}

type TextFormGroup = FormGroup<{
  language: FormControl<string>;
  psm: FormControl<number>;
  oem: FormControl<number>;
  rememberHistory: FormControl<boolean>;
}>;

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const SUPPORTED_LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'rus', name: 'Russian' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'kor', name: 'Korean' },
  { code: 'ara', name: 'Arabic' },
  { code: 'hin', name: 'Hindi' }
];

// PSM (Page Segmentation Mode) options
const PSM_OPTIONS = [
  { value: 3, label: 'Fully automatic (default)' },
  { value: 6, label: 'Single uniform block' },
  { value: 7, label: 'Single text line' },
  { value: 8, label: 'Single word' },
  { value: 11, label: 'Sparse text' },
  { value: 12, label: 'Sparse text with OSD' }
];

@Component({
  selector: 'lib-image-to-text',
  standalone: true,
  templateUrl: './image-to-text.html',
  styleUrls: ['./image-to-text.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageToTextComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;

  readonly form: TextFormGroup = this.fb.group({
    language: this.fb.control('eng', { nonNullable: true }),
    psm: this.fb.control(3, { nonNullable: true }),
    oem: this.fb.control(3, { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly languages = SUPPORTED_LANGUAGES;
  readonly psmOptions = PSM_OPTIONS;
  readonly maxFileSize = MAX_FILE_SIZE;
  
  readonly selectedFile = signal<File | null>(null);
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly result: WritableSignal<TextExtractionResult | null> = signal(null);
  readonly history = signal<HistoryEntry[]>([]);
  readonly isProcessing = signal(false);
  readonly progress = signal(0);
  readonly dragActive = signal(false);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly extractedText = computed(() => this.result()?.text ?? '');
  readonly wordCount = computed(() => this.result()?.words ?? 0);
  readonly charCount = computed(() => this.result()?.characters ?? 0);

  private tesseractWorker: any = null;
  private tesseractAvailable = false;

  ngOnInit(): void {
    // Initialize Tesseract.js worker lazily
    this.initializeTesseract();
  }

  private async initializeTesseract(): Promise<void> {
    try {
      // Dynamic import of Tesseract.js - wrapped in eval to avoid compile-time error
      const tesseractModule = await (eval('import("tesseract.js")') as Promise<any>);
      this.tesseractWorker = await tesseractModule.createWorker();
      await this.tesseractWorker.loadLanguage(this.form.controls.language.value);
      await this.tesseractWorker.initialize(this.form.controls.language.value);
      this.tesseractAvailable = true;
    } catch (error) {
      console.warn('Tesseract.js not available. Using fallback text extraction.', error);
      this.tesseractAvailable = false;
      this.warnings.set(['Tesseract.js OCR library not loaded. Install tesseract.js package for OCR functionality.']);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) {
      this.handleFile(file);
    }
  }

  handleFileInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input?.files?.length) {
      return;
    }
    const file = input.files[0];
    this.handleFile(file);
    input.value = '';
  }

  async handleFile(file: File): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);
    this.result.set(null);
    this.progress.set(0);

    if (!file.type.startsWith('image/')) {
      this.errors.set(['Please select a valid image file.']);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      this.errors.set([
        `File size ${this.formatBytes(file.size)} exceeds the ${this.formatBytes(MAX_FILE_SIZE)} limit.`,
        'Consider compressing the image before processing.'
      ]);
      return;
    }

    this.selectedFile.set(file);
    await this.extractText(file);
  }

  async extractText(file: File): Promise<void> {
    this.isProcessing.set(true);
    this.progress.set(0);

    try {
      const startTime = Date.now();
      const previewUrl = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(file));

      let extractedText = '';
      let confidence = 0;

      if (this.tesseractAvailable && this.tesseractWorker) {
        try {
          // Use Tesseract.js for OCR
          const { data } = await this.tesseractWorker.recognize(file, {
            logger: (m: any) => {
              if (m.status === 'recognizing text') {
                this.progress.set(Math.round(m.progress * 100));
              }
            }
          });
          extractedText = data.text;
          confidence = data.confidence;
        } catch (error) {
          console.error('Tesseract OCR failed:', error);
          this.warnings.set(['OCR processing failed. Using fallback.']);
          extractedText = await this.basicTextExtraction(file);
        }
      } else {
        // Fallback: Try to extract text using canvas (limited)
        extractedText = await this.basicTextExtraction(file);
      }

      const processingTime = Date.now() - startTime;
      const words = extractedText.trim() ? extractedText.trim().split(/\s+/).length : 0;
      const characters = extractedText.length;
      const lines = extractedText.trim() ? extractedText.split('\n').filter(line => line.trim()).length : 0;

      const result: TextExtractionResult = {
        text: extractedText,
        confidence: Math.round(confidence),
        words,
        characters,
        lines,
        previewUrl,
        filename: file.name || null,
        processingTime
      };

      this.result.set(result);

      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(result);
      }
    } catch (error) {
      this.errors.set([`Failed to extract text: ${(error as Error)?.message ?? 'Unknown error'}`]);
      this.result.set(null);
    } finally {
      this.isProcessing.set(false);
      this.progress.set(0);
    }
  }

  private async basicTextExtraction(file: File): Promise<string> {
    // Basic fallback - just return a message
    // In a real implementation, you might use canvas-based text detection
    return 'Text extraction requires Tesseract.js library. Please install tesseract.js package for OCR functionality.\n\nTo install: npm install tesseract.js';
  }

  async copyToClipboard(): Promise<void> {
    const current = this.result();
    if (!current) {
      return;
    }
    try {
      await navigator.clipboard.writeText(current.text);
      // Could show success toast
    } catch (error) {
      this.errors.set([`Unable to copy: ${(error as Error)?.message ?? 'Clipboard access denied.'}`]);
    }
  }

  downloadText(): void {
    const current = this.result();
    if (!current) {
      return;
    }
    const blob = new Blob([current.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${current.filename?.replace(/\.[^/.]+$/, '') ?? 'extracted-text'}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  clear(): void {
    this.selectedFile.set(null);
    this.result.set(null);
    this.errors.set([]);
    this.warnings.set([]);
    this.progress.set(0);
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  applyHistory(entry: HistoryEntry): void {
    const result: TextExtractionResult = {
      text: entry.text,
      confidence: 0,
      words: entry.words,
      characters: entry.text.length,
      lines: entry.text.split('\n').filter(line => line.trim()).length,
      previewUrl: this.sanitizer.bypassSecurityTrustUrl(entry.preview),
      filename: entry.filename,
      processingTime: 0
    };
    this.result.set(result);
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  private addToHistory(result: TextExtractionResult): void {
    // Get the URL string from SafeUrl
    const previewUrl = typeof result.previewUrl === 'string' 
      ? result.previewUrl 
      : (result.previewUrl as any)?.changingThisBreaksApplicationSecurity || '';
    
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      filename: result.filename,
      text: result.text,
      words: result.words,
      preview: previewUrl
    };
    this.history.update((entries) => {
      const exists = entries.some((e) => e.text === entry.text && e.filename === entry.filename);
      if (exists) {
        return entries;
      }
      return [entry, ...entries].slice(0, 10);
    });
  }

  formatBytes(value: number): string {
    if (value === 0) {
      return '0 B';
    }
    const UNITS = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), UNITS.length - 1);
    const scaled = value / Math.pow(1024, exponent);
    return `${scaled.toFixed(scaled >= 10 || exponent === 0 ? 0 : 1)} ${UNITS[exponent]}`;
  }

  async onLanguageChange(): Promise<void> {
    if (this.tesseractAvailable && this.tesseractWorker && this.selectedFile()) {
      const language = this.form.controls.language.value;
      try {
        await this.tesseractWorker.loadLanguage(language);
        await this.tesseractWorker.initialize(language);
        // Re-extract text with new language
        const file = this.selectedFile();
        if (file) {
          await this.extractText(file);
        }
      } catch (error) {
        this.errors.set([`Failed to load language: ${(error as Error)?.message ?? 'Unknown error'}`]);
      }
    }
  }
}

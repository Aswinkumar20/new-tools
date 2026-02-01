import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  percentage: number;
}

interface PaletteResult {
  colors: ColorInfo[];
  previewUrl: SafeUrl;
  filename: string | null;
  method: string;
  colorCount: number;
}

interface HistoryEntry {
  timestamp: number;
  filename: string | null;
  colors: ColorInfo[];
  preview: string;
}

type PaletteFormGroup = FormGroup<{
  colorCount: FormControl<number>;
  method: FormControl<string>;
  rememberHistory: FormControl<boolean>;
}>;

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const EXTRACTION_METHODS = [
  { value: 'dominant', label: 'Dominant colors' },
  { value: 'vibrant', label: 'Vibrant colors' },
  { value: 'muted', label: 'Muted colors' },
  { value: 'light', label: 'Light colors' },
  { value: 'dark', label: 'Dark colors' }
];

@Component({
  selector: 'lib-palette-generator',
  standalone: true,
  templateUrl: './palette-generator.html',
  styleUrls: ['./palette-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaletteGeneratorComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imageCanvas', { static: false }) imageCanvas!: ElementRef<HTMLCanvasElement>;

  readonly form: PaletteFormGroup = this.fb.group({
    colorCount: this.fb.control(5, { nonNullable: true }),
    method: this.fb.control('dominant', { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly methods = EXTRACTION_METHODS;
  readonly maxFileSize = MAX_FILE_SIZE;
  
  readonly selectedFile = signal<File | null>(null);
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly result: WritableSignal<PaletteResult | null> = signal(null);
  readonly history = signal<HistoryEntry[]>([]);
  readonly isProcessing = signal(false);
  readonly progress = signal(0);
  readonly dragActive = signal(false);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly extractedColors = computed(() => this.result()?.colors ?? []);
  readonly currentMethodLabel = computed(() => {
    const method = this.methods.find(m => m.value === this.form.controls.method.value);
    return method?.label ?? 'Dominant colors';
  });

  ngOnInit(): void {
    // Component initialization
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
    await this.extractPalette(file);
  }

  async extractPalette(file: File): Promise<void> {
    this.isProcessing.set(true);
    this.progress.set(10);

    try {
      const previewUrl = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(file));
      const { colorCount, method } = this.form.getRawValue();
      
      this.progress.set(30);
      
      // Load image and extract colors
      const colors = await this.extractColorsFromImage(file, colorCount, method);
      
      this.progress.set(90);

      const result: PaletteResult = {
        colors,
        previewUrl,
        filename: file.name || null,
        method: EXTRACTION_METHODS.find(m => m.value === method)?.label || method,
        colorCount: colors.length
      };

      this.result.set(result);
      this.progress.set(100);

      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(result);
      }
    } catch (error) {
      this.errors.set([`Failed to extract palette: ${(error as Error)?.message ?? 'Unknown error'}`]);
      this.result.set(null);
    } finally {
      this.isProcessing.set(false);
      setTimeout(() => this.progress.set(0), 500);
    }
  }

  private async extractColorsFromImage(file: File, count: number, method: string): Promise<ColorInfo[]> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          // Resize image for faster processing
          const maxSize = 200;
          const scale = Math.min(maxSize / img.width, maxSize / img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const pixels = imageData.data;

          // Extract color data
          const colorMap = new Map<string, { r: number; g: number; b: number; count: number }>();
          
          // Sample pixels (every nth pixel for performance)
          const sampleRate = Math.max(1, Math.floor(pixels.length / 4 / 10000));
          
          for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = pixels[i + 3];

            // Skip transparent pixels
            if (a < 128) continue;

            // Quantize colors to reduce noise
            const qr = Math.floor(r / 10) * 10;
            const qg = Math.floor(g / 10) * 10;
            const qb = Math.floor(b / 10) * 10;
            const key = `${qr},${qg},${qb}`;

            if (colorMap.has(key)) {
              const existing = colorMap.get(key)!;
              existing.count++;
            } else {
              colorMap.set(key, { r: qr, g: qg, b: qb, count: 1 });
            }
          }

          // Convert to array and sort by frequency
          const colorArray = Array.from(colorMap.entries())
            .map(([_, value]) => value)
            .sort((a, b) => b.count - a.count);

          // Apply method-specific filtering
          let filteredColors = this.filterColorsByMethod(colorArray, method);

          // Take top N colors
          filteredColors = filteredColors.slice(0, count);

          // Calculate percentages and convert to ColorInfo
          const total = filteredColors.reduce((sum, c) => sum + c.count, 0);
          const colors: ColorInfo[] = filteredColors.map(color => {
            const hex = this.rgbToHex(color.r, color.g, color.b);
            const hsl = this.rgbToHsl(color.r, color.g, color.b);
            return {
              hex,
              rgb: { r: color.r, g: color.g, b: color.b },
              hsl,
              percentage: Math.round((color.count / total) * 100)
            };
          });

          resolve(colors);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  private filterColorsByMethod(colors: Array<{ r: number; g: number; b: number; count: number }>, method: string): Array<{ r: number; g: number; b: number; count: number }> {
    switch (method) {
      case 'vibrant':
        return colors.filter(c => {
          const hsl = this.rgbToHsl(c.r, c.g, c.b);
          return hsl.s > 50 && hsl.l > 30 && hsl.l < 70;
        });
      case 'muted':
        return colors.filter(c => {
          const hsl = this.rgbToHsl(c.r, c.g, c.b);
          return hsl.s < 50;
        });
      case 'light':
        return colors.filter(c => {
          const hsl = this.rgbToHsl(c.r, c.g, c.b);
          return hsl.l > 60;
        });
      case 'dark':
        return colors.filter(c => {
          const hsl = this.rgbToHsl(c.r, c.g, c.b);
          return hsl.l < 40;
        });
      default: // dominant
        return colors;
    }
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
      const hex = Math.round(n).toString(16).padStart(2, '0');
      return hex.toUpperCase();
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const delta = max - min;
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / delta + 2) / 6;
          break;
        case b:
          h = ((r - g) / delta + 4) / 6;
          break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  copyToClipboard(value: string, label: string): void {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        // Success - could show toast
      })
      .catch(() => {
        this.errors.set([`Unable to copy ${label} to clipboard.`]);
      });
  }

  downloadPalette(): void {
    const current = this.result();
    if (!current) return;

    const css = current.colors
      .map((color, index) => `/* Color ${index + 1} - ${color.percentage}% */\n--color-${index + 1}: ${color.hex};\n--color-${index + 1}-rgb: ${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b};\n--color-${index + 1}-hsl: ${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%;`)
      .join('\n\n');

    const blob = new Blob([css], { type: 'text/css;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${current.filename?.replace(/\.[^/.]+$/, '') ?? 'palette'}.css`;
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
    const result: PaletteResult = {
      colors: entry.colors,
      previewUrl: this.sanitizer.bypassSecurityTrustUrl(entry.preview),
      filename: entry.filename,
      method: 'History',
      colorCount: entry.colors.length
    };
    this.result.set(result);
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  private addToHistory(result: PaletteResult): void {
    const previewUrl = typeof result.previewUrl === 'string' 
      ? result.previewUrl 
      : (result.previewUrl as any)?.changingThisBreaksApplicationSecurity || '';
    
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      filename: result.filename,
      colors: result.colors,
      preview: previewUrl
    };
    this.history.update((entries) => {
      const exists = entries.some((e) => 
        e.colors.length === entry.colors.length &&
        e.colors.every((c, i) => c.hex === entry.colors[i]?.hex)
      );
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
}

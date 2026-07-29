import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  FAVICON_ALL_SIZES_STAGGER_MS,
  FAVICON_DEBOUNCE_MS,
  FAVICON_DEFAULTS,
  FAVICON_ERROR,
  FAVICON_FONT_FAMILIES,
  FAVICON_INIT_DELAY_MS,
  FAVICON_RELATED_TOOLS,
  FAVICON_RETRY_DELAY_MS,
  FAVICON_SIZES
} from '../../constants/favicon-generator.constants';
import { ictCopyText } from '../../shared/ict-clipboard.util';
import { ictDownloadBlob } from '../../shared/ict-download.util';
import type { IctRelatedToolLink } from '../../shared/ict-tool-suggestion.model';
import type {
  FaviconFormGroup,
  FaviconFormValues,
  FaviconFormat,
  FaviconHistoryEntry,
  FaviconMode,
  FaviconResult,
  FaviconSize
} from '../../types/favicon-generator.types';
import { hexColorValidator } from '../../utils/ict-color.utils';
import {
  buildFaviconFilename,
  buildFaviconHtmlCode,
  createFaviconHistoryEntry,
  drawEmojiFavicon,
  drawImageFavicon,
  drawTextFavicon,
  prependUniqueFaviconHistory,
  resolveFaviconSuggestion
} from '../../utils/favicon-generator.utils';

@Component({
  selector: 'lib-favicon-generator',
  standalone: true,
  templateUrl: './favicon-generator.html',
  styleUrls: ['./favicon-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FaviconGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  @ViewChild('previewCanvas', { static: false }) previewCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;

  readonly form: FaviconFormGroup = this.fb.group({
    mode: this.fb.control<FaviconMode>(FAVICON_DEFAULTS.mode, { nonNullable: true }),
    text: this.fb.control(FAVICON_DEFAULTS.text, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(3)]
    }),
    fontSize: this.fb.control(FAVICON_DEFAULTS.fontSize, {
      nonNullable: true,
      validators: [Validators.min(10), Validators.max(200)]
    }),
    fontFamily: this.fb.control(FAVICON_DEFAULTS.fontFamily, { nonNullable: true }),
    backgroundColor: this.fb.control(FAVICON_DEFAULTS.backgroundColor, {
      nonNullable: true,
      validators: [hexColorValidator]
    }),
    textColor: this.fb.control(FAVICON_DEFAULTS.textColor, {
      nonNullable: true,
      validators: [hexColorValidator]
    }),
    emoji: this.fb.control(FAVICON_DEFAULTS.emoji, { nonNullable: true }),
    size: this.fb.control<FaviconSize>(FAVICON_DEFAULTS.size, { nonNullable: true }),
    format: this.fb.control<FaviconFormat>(FAVICON_DEFAULTS.format, { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly sizes: ReadonlyArray<FaviconSize> = FAVICON_SIZES;
  readonly fontFamilies: ReadonlyArray<string> = FAVICON_FONT_FAMILIES;
  readonly relatedTools: ReadonlyArray<IctRelatedToolLink> = FAVICON_RELATED_TOOLS;
  readonly previewSizes = [16, 32, 48] as const;

  readonly formSnapshot = signal<FaviconFormValues>(this.form.getRawValue());
  readonly result = signal<FaviconResult | null>(null);
  readonly errors = signal<string[]>([]);
  readonly history = signal<FaviconHistoryEntry[]>([]);
  readonly uploadedImage = signal<HTMLImageElement | null>(null);
  readonly isProcessing = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly currentMode = computed(() => this.formSnapshot().mode);

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveFaviconSuggestion({
      mode: this.formSnapshot().mode,
      hasResult: this.result() !== null,
      hasUploadedImage: this.uploadedImage() !== null,
      hasError: this.errors().length > 0,
      historyCount: this.history().length
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges
      .pipe(
        debounceTime(FAVICON_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.formSnapshot.set(this.form.getRawValue());
        this.generateFavicon();
      });

    setTimeout(() => this.generateFavicon(), FAVICON_INIT_DELAY_MS);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.errors.set([FAVICON_ERROR.invalidImage]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.uploadedImage.set(img);
        this.form.patchValue({ mode: 'image' });
        this.formSnapshot.set(this.form.getRawValue());
        this.generateFavicon();
      };
      img.onerror = () => {
        this.errors.set([FAVICON_ERROR.loadImage]);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      this.errors.set([FAVICON_ERROR.readFile]);
    };
    reader.readAsDataURL(file);
  }

  generateFavicon(): void {
    this.errors.set([]);
    this.isProcessing.set(true);
    this.formSnapshot.set(this.form.getRawValue());

    try {
      const canvas = this.previewCanvas?.nativeElement;
      if (!canvas) {
        setTimeout(() => this.generateFavicon(), FAVICON_RETRY_DELAY_MS);
        return;
      }

      const {
        mode,
        size,
        format,
        text,
        fontSize,
        fontFamily,
        backgroundColor,
        textColor,
        emoji
      } = this.form.getRawValue();

      let ctx: CanvasRenderingContext2D | null = null;
      try {
        ctx = canvas.getContext('2d');
      } catch {
        ctx = null;
      }
      if (!ctx) {
        this.errors.set([FAVICON_ERROR.noCanvas]);
        this.isProcessing.set(false);
        return;
      }

      canvas.width = size;
      canvas.height = size;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, size, size);

      if (mode === 'text') {
        drawTextFavicon(ctx, size, text, fontSize, fontFamily, textColor);
      } else if (mode === 'emoji') {
        drawEmojiFavicon(ctx, size, emoji, fontSize);
      } else if (mode === 'image') {
        const img = this.uploadedImage();
        if (img) {
          drawImageFavicon(ctx, size, img);
        } else {
          this.errors.set([FAVICON_ERROR.noImage]);
          this.isProcessing.set(false);
          return;
        }
      }

      const dataUrl = canvas.toDataURL('image/png');
      const faviconResult: FaviconResult = {
        dataUrl,
        size,
        format,
        htmlCode: buildFaviconHtmlCode(dataUrl, size)
      };

      this.result.set(faviconResult);

      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(faviconResult, mode);
      }
    } catch (error) {
      this.errors.set([
        `Failed to generate favicon: ${(error as Error)?.message ?? 'Unknown error'}`
      ]);
    } finally {
      this.isProcessing.set(false);
    }
  }

  downloadFavicon(): void {
    const current = this.result();
    if (!current) {
      return;
    }

    const canvas = this.previewCanvas?.nativeElement;
    if (!canvas) {
      return;
    }

    const { format, size } = current;

    canvas.toBlob((blob) => {
      if (!blob) {
        this.toast.error('Unable to export favicon');
        return;
      }
      ictDownloadBlob(this.toast, blob, buildFaviconFilename(size, format), 'Favicon');
    }, 'image/png');
  }

  downloadAllSizes(): void {
    const originalSize = this.form.controls.size.value;
    const originalResult = this.result();

    this.toast.info('Downloading all favicon sizes');

    FAVICON_SIZES.forEach((size) => {
      this.form.patchValue({ size }, { emitEvent: false });
      setTimeout(() => {
        this.generateFavicon();
        setTimeout(() => {
          const generated = this.result();
          if (generated) {
            const canvas = this.previewCanvas?.nativeElement;
            if (canvas) {
              canvas.toBlob((blob) => {
                if (!blob) {
                  return;
                }
                ictDownloadBlob(
                  this.toast,
                  blob,
                  buildFaviconFilename(size, 'png'),
                  'Favicon',
                  { silent: true }
                );
              }, 'image/png');
            }
          }
        }, FAVICON_RETRY_DELAY_MS);
      }, size * FAVICON_ALL_SIZES_STAGGER_MS);
    });

    setTimeout(() => {
      this.form.patchValue({ size: originalSize });
      this.formSnapshot.set(this.form.getRawValue());
      if (originalResult) {
        this.result.set(originalResult);
      }
    }, FAVICON_SIZES.length * 100);
  }

  async copyHtmlCode(): Promise<void> {
    const current = this.result();
    if (!current) {
      return;
    }
    const ok = await ictCopyText(this.toast, current.htmlCode, 'HTML');
    if (!ok) {
      this.errors.set([FAVICON_ERROR.copyHtml]);
    }
  }

  async copyToClipboard(value: string, label: string): Promise<void> {
    const ok = await ictCopyText(this.toast, value, label);
    if (!ok) {
      this.errors.set([`Unable to copy ${label} to clipboard.`]);
    }
  }

  clear(): void {
    this.uploadedImage.set(null);
    this.result.set(null);
    this.errors.set([]);
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
    this.form.patchValue({
      mode: FAVICON_DEFAULTS.mode,
      text: FAVICON_DEFAULTS.text,
      fontSize: FAVICON_DEFAULTS.fontSize,
      fontFamily: FAVICON_DEFAULTS.fontFamily,
      backgroundColor: FAVICON_DEFAULTS.backgroundColor,
      textColor: FAVICON_DEFAULTS.textColor,
      emoji: FAVICON_DEFAULTS.emoji,
      size: FAVICON_DEFAULTS.size
    });
    this.formSnapshot.set(this.form.getRawValue());
    setTimeout(() => this.generateFavicon(), FAVICON_INIT_DELAY_MS);
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  applyHistory(entry: FaviconHistoryEntry): void {
    this.form.patchValue({ mode: entry.mode, size: entry.size });
    this.formSnapshot.set(this.form.getRawValue());
    setTimeout(() => this.generateFavicon(), FAVICON_INIT_DELAY_MS);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private addToHistory(result: FaviconResult, mode: FaviconMode): void {
    const entry = createFaviconHistoryEntry(result, mode);
    this.history.update((entries) => prependUniqueFaviconHistory(entries, entry));
  }
}

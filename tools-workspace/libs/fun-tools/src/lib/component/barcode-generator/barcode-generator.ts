import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { Subscription } from 'rxjs';
import {
  BARCODE_DEFAULT_OPTIONS,
  BARCODE_FORMATS,
  BARCODE_RELATED_TOOLS
} from '../../constants/barcode-generator.constants';
import { ftCopyText } from '../../shared/ft-clipboard.util';
import type { FtRelatedToolLink } from '../../shared/ft-tool-suggestion.model';
import type { BarcodeFormGroup, BarcodeOptions } from '../../types/barcode-generator.types';
import {
  copyBarcodeImageToClipboard,
  downloadBarcodeDataUrl,
  loadJsBarcodeLibrary,
  mapBarcodeGenerationError,
  renderBarcodeToDataUrl,
  resolveBarcodeSuggestion
} from '../../utils/barcode-generator.utils';

@Component({
  selector: 'lib-barcode-generator',
  standalone: true,
  templateUrl: './barcode-generator.html',
  styleUrls: ['./barcode-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BarcodeGeneratorComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);
  private formSubscription?: Subscription;

  readonly form: BarcodeFormGroup = this.fb.group({
    text: this.fb.control(BARCODE_DEFAULT_OPTIONS.text, { nonNullable: true }),
    format: this.fb.control(BARCODE_DEFAULT_OPTIONS.format, { nonNullable: true }),
    width: this.fb.control(BARCODE_DEFAULT_OPTIONS.width, { nonNullable: true }),
    height: this.fb.control(BARCODE_DEFAULT_OPTIONS.height, { nonNullable: true }),
    displayValue: this.fb.control(BARCODE_DEFAULT_OPTIONS.displayValue, { nonNullable: true }),
    fontSize: this.fb.control(BARCODE_DEFAULT_OPTIONS.fontSize, { nonNullable: true }),
    textAlign: this.fb.control(BARCODE_DEFAULT_OPTIONS.textAlign, { nonNullable: true }),
    textPosition: this.fb.control(BARCODE_DEFAULT_OPTIONS.textPosition, { nonNullable: true }),
    textMargin: this.fb.control(BARCODE_DEFAULT_OPTIONS.textMargin, { nonNullable: true }),
    background: this.fb.control(BARCODE_DEFAULT_OPTIONS.background, { nonNullable: true }),
    lineColor: this.fb.control(BARCODE_DEFAULT_OPTIONS.lineColor, { nonNullable: true }),
    margin: this.fb.control(BARCODE_DEFAULT_OPTIONS.margin, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly barcodeDataUrl = signal<string | null>(null);
  readonly libraryLoaded = signal(false);
  readonly formSnapshot = signal<BarcodeOptions>(this.form.getRawValue());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasBarcode = computed(() => this.barcodeDataUrl() !== null);
  readonly formats = BARCODE_FORMATS;
  readonly relatedTools: ReadonlyArray<FtRelatedToolLink> = BARCODE_RELATED_TOOLS;

  readonly primarySuggestion = computed(() => {
    const snapshot = this.formSnapshot();
    const suggestion = resolveBarcodeSuggestion({
      text: snapshot.text,
      format: snapshot.format,
      hasBarcode: this.hasBarcode(),
      hasError: this.errors().length > 0,
      libraryLoaded: this.libraryLoaded()
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.formSubscription = this.form.valueChanges.subscribe(() => {
      const values = this.form.getRawValue();
      this.formSnapshot.set(values);
      if (this.libraryLoaded() && values.text.trim().length > 0) {
        this.generateBarcode(values);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadBarcodeLibrary();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private async loadBarcodeLibrary(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      await loadJsBarcodeLibrary();
      this.libraryLoaded.set(true);
      this.generateBarcode(this.form.getRawValue());
    } catch (e) {
      this.errors.set([e instanceof Error ? e.message : 'Failed to load barcode library.']);
    }
  }

  private generateBarcode(options: BarcodeOptions): void {
    if (!this.libraryLoaded()) {
      return;
    }

    try {
      this.barcodeDataUrl.set(renderBarcodeToDataUrl(options));
      this.errors.set([]);
    } catch (e) {
      this.errors.set([mapBarcodeGenerationError(options.format, options.text, e)]);
      this.barcodeDataUrl.set(null);
    }
  }

  downloadBarcode(): void {
    const dataUrl = this.barcodeDataUrl();
    if (!dataUrl) {
      return;
    }

    try {
      downloadBarcodeDataUrl(dataUrl);
      this.toast.info('Barcode downloaded');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to download barcode.';
      this.errors.set([message]);
      this.toast.error(message);
    }
  }

  async copyData(): Promise<void> {
    await ftCopyText(this.toast, this.form.controls.text.value.trim(), 'Barcode data');
  }

  async copyBarcode(): Promise<void> {
    const dataUrl = this.barcodeDataUrl();
    if (!dataUrl) {
      return;
    }

    try {
      await copyBarcodeImageToClipboard(dataUrl);
      this.toast.info('Barcode image copied to clipboard');
    } catch {
      const message = 'Failed to copy barcode to clipboard.';
      this.errors.set([message]);
      this.toast.error(message);
    }
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
  }
}

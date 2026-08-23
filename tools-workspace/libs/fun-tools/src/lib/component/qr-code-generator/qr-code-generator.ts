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
  QR_CODE_DEFAULT_OPTIONS,
  QR_CODE_RELATED_TOOLS
} from '../../constants/qr-code-generator.constants';
import { ftCopyText } from '../../shared/ft-clipboard.util';
import type { FtRelatedToolLink } from '../../shared/ft-tool-suggestion.model';
import type { QrCodeFormGroup, QrCodeOptions } from '../../types/qr-code-generator.types';
import {
  copyQrCodeImageToClipboard,
  downloadQrCodeDataUrl,
  loadQrCodeLibrary,
  mapQrGenerationError,
  renderQrCodeToDataUrl,
  resolveQrCodeSuggestion
} from '../../utils/qr-code-generator.utils';

@Component({
  selector: 'lib-qr-code-generator',
  standalone: true,
  templateUrl: './qr-code-generator.html',
  styleUrls: ['./qr-code-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QrCodeGeneratorComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);
  private formSubscription?: Subscription;
  private generateRequestId = 0;

  readonly form: QrCodeFormGroup = this.fb.group({
    text: this.fb.control(QR_CODE_DEFAULT_OPTIONS.text, { nonNullable: true }),
    size: this.fb.control(QR_CODE_DEFAULT_OPTIONS.size, { nonNullable: true }),
    errorCorrectionLevel: this.fb.control(QR_CODE_DEFAULT_OPTIONS.errorCorrectionLevel, {
      nonNullable: true
    }),
    darkColor: this.fb.control(QR_CODE_DEFAULT_OPTIONS.darkColor, { nonNullable: true }),
    lightColor: this.fb.control(QR_CODE_DEFAULT_OPTIONS.lightColor, { nonNullable: true }),
    margin: this.fb.control(QR_CODE_DEFAULT_OPTIONS.margin, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly qrCodeDataUrl = signal<string | null>(null);
  readonly libraryLoaded = signal(false);
  readonly formSnapshot = signal<QrCodeOptions>(this.form.getRawValue());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasQRCode = computed(() => this.qrCodeDataUrl() !== null);
  readonly relatedTools: ReadonlyArray<FtRelatedToolLink> = QR_CODE_RELATED_TOOLS;

  readonly primarySuggestion = computed(() => {
    const snapshot = this.formSnapshot();
    const suggestion = resolveQrCodeSuggestion({
      text: snapshot.text,
      errorCorrectionLevel: snapshot.errorCorrectionLevel,
      hasQrCode: this.hasQRCode(),
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
        void this.generateQRCode(values);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadQRCodeLibrary();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private async loadQRCodeLibrary(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      await loadQrCodeLibrary();
      this.libraryLoaded.set(true);
      await this.generateQRCode(this.form.getRawValue());
    } catch (e) {
      this.errors.set([e instanceof Error ? e.message : 'Failed to load QR code library.']);
    }
  }

  private async generateQRCode(options: QrCodeOptions): Promise<void> {
    if (!this.libraryLoaded()) {
      return;
    }

    const requestId = ++this.generateRequestId;
    try {
      const dataUrl = await renderQrCodeToDataUrl(options);
      if (requestId !== this.generateRequestId) {
        return;
      }
      this.qrCodeDataUrl.set(dataUrl);
      this.errors.set([]);
    } catch (e) {
      if (requestId !== this.generateRequestId) {
        return;
      }
      this.errors.set([mapQrGenerationError(e)]);
      this.qrCodeDataUrl.set(null);
    }
  }

  downloadQRCode(): void {
    const dataUrl = this.qrCodeDataUrl();
    if (!dataUrl) {
      return;
    }

    try {
      downloadQrCodeDataUrl(dataUrl);
      this.toast.info('QR code downloaded');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to download QR code.';
      this.errors.set([message]);
      this.toast.error(message);
    }
  }

  async copyContent(): Promise<void> {
    await ftCopyText(this.toast, this.form.controls.text.value.trim(), 'QR content');
  }

  async copyQRCode(): Promise<void> {
    const dataUrl = this.qrCodeDataUrl();
    if (!dataUrl) {
      return;
    }

    try {
      await copyQrCodeImageToClipboard(dataUrl);
      this.toast.info('QR code image copied to clipboard');
    } catch {
      const message = 'Failed to copy QR code to clipboard.';
      this.errors.set([message]);
      this.toast.error(message);
    }
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Navigation,
  TooltipDirective,
  AssetService,
  ToastService
} from '@tools-workspace/features-home';
import type { TtRelatedToolLink } from '../../shared/tt-tool-suggestion.model';
import { ttCopyText } from '../../shared/tt-clipboard.util';
import {
  JWT_DECODER_DEFAULT_FORM,
  JWT_DECODER_RELATED_TOOLS
} from '../../constants/jwt-decoder.constants';
import type {
  DecodedJwt,
  JwtDecoderFormGroup,
  JwtDecoderFormValues
} from '../../types/jwt-decoder.types';
import {
  buildDecodedJwtCopyText,
  countJwtParts,
  decodeJwtToken,
  resolveJwtSuggestion
} from '../../utils/jwt-decoder.utils';

@Component({
  selector: 'lib-jwt-decoder',
  standalone: true,
  templateUrl: './jwt-decoder.html',
  styleUrls: ['./jwt-decoder.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JwtDecoderComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly relatedTools: ReadonlyArray<TtRelatedToolLink> = JWT_DECODER_RELATED_TOOLS;

  readonly form: JwtDecoderFormGroup = this.fb.group({
    token: this.fb.control(JWT_DECODER_DEFAULT_FORM.token, { nonNullable: true }),
    prettyPrint: this.fb.control(JWT_DECODER_DEFAULT_FORM.prettyPrint, { nonNullable: true }),
    showDecoded: this.fb.control(JWT_DECODER_DEFAULT_FORM.showDecoded, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly decoded = signal<DecodedJwt | null>(null);
  readonly formSnapshot = signal<JwtDecoderFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasToken = computed(() => !!this.formSnapshot().token.trim());
  readonly hasDecoded = computed(() => this.decoded() !== null);
  readonly tokenParts = computed(() => countJwtParts(this.formSnapshot().token));
  readonly showDecoded = computed(() => this.formSnapshot().showDecoded);
  readonly prettyPrintOn = computed(() => this.formSnapshot().prettyPrint);

  readonly primarySuggestion = computed(() => {
    const current = this.decoded();
    const suggestion = resolveJwtSuggestion({
      hasToken: this.hasToken(),
      hasDecoded: this.hasDecoded(),
      partCount: this.tokenParts(),
      errorMessage: this.errors()[0] ?? null,
      warningMessage: this.warnings()[0] ?? null,
      headerError: current?.header.error ?? null,
      payloadError: current?.payload.error ?? null,
      signaturePresent: current?.signature.present ?? false
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formSnapshot.set(this.readFormValues());
    });
  }

  onTokenInput(): void {
    this.formSnapshot.set(this.readFormValues());
    if (this.hasToken()) {
      this.decode();
    } else {
      this.clearResults();
    }
  }

  onOptionChange(): void {
    this.formSnapshot.set(this.readFormValues());
    if (this.hasToken()) {
      this.decode();
    }
  }

  decode(): void {
    this.dismissedSuggestionId.set(null);
    const { token, prettyPrint } = this.form.getRawValue();
    const { decoded, errors, warnings } = decodeJwtToken(token, prettyPrint);
    this.errors.set(errors);
    this.warnings.set(warnings);
    this.decoded.set(decoded);
  }

  clear(): void {
    this.form.controls.token.setValue('');
    this.clearResults();
    this.dismissedSuggestionId.set(null);
    this.formSnapshot.set(this.readFormValues());
    this.toast.info('Cleared');
  }

  async copyToken(): Promise<void> {
    await ttCopyText(this.toast, this.form.controls.token.value, 'Token');
  }

  async copyDecoded(): Promise<void> {
    const current = this.decoded();
    if (!current) {
      return;
    }
    await ttCopyText(this.toast, buildDecodedJwtCopyText(current), 'Decoded JWT');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private clearResults(): void {
    this.errors.set([]);
    this.warnings.set([]);
    this.decoded.set(null);
  }

  private readFormValues(): JwtDecoderFormValues {
    return this.form.getRawValue();
  }
}

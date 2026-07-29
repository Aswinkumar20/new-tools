import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
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
import type { StRelatedToolLink } from '../../shared/st-tool-suggestion.model';
import { stCopyText } from '../../shared/st-clipboard.util';
import { stEncryptAesGcm } from '../../shared/st-aes-gcm.util';
import {
  SECURE_CLIPBOARD_DEFAULT_FORM,
  SECURE_CLIPBOARD_EMPTY_STATE,
  SECURE_CLIPBOARD_EXPIRED_WARNING,
  SECURE_CLIPBOARD_RELATED_TOOLS,
  SECURE_CLIPBOARD_STORED_WARNING,
  SECURE_CLIPBOARD_TIMER_MS
} from '../../constants/secure-clipboard.constants';
import type {
  SecureClipboardFormGroup,
  SecureClipboardFormValues,
  SecureClipboardState
} from '../../types/secure-clipboard.types';
import {
  computeSecureClipboardRemainingSeconds,
  formatSecureClipboardExpiresAt,
  isSecureClipboardExpired,
  mapSecureClipboardError,
  resolveSecureClipboardStatusLabel,
  resolveSecureClipboardSuggestion,
  validateSecureClipboardStore
} from '../../utils/secure-clipboard.utils';

@Component({
  selector: 'lib-secure-clipboard',
  standalone: true,
  templateUrl: './secure-clipboard.html',
  styleUrls: ['./secure-clipboard.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SecureClipboardComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private intervalId: number | null = null;
  readonly assetService = inject(AssetService);

  readonly relatedTools: ReadonlyArray<StRelatedToolLink> = SECURE_CLIPBOARD_RELATED_TOOLS;

  readonly form: SecureClipboardFormGroup = this.fb.group({
    text: this.fb.control(SECURE_CLIPBOARD_DEFAULT_FORM.text, { nonNullable: true }),
    password: this.fb.control(SECURE_CLIPBOARD_DEFAULT_FORM.password, { nonNullable: true }),
    ttlSeconds: this.fb.control(SECURE_CLIPBOARD_DEFAULT_FORM.ttlSeconds, {
      nonNullable: true
    })
  });

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly state = signal<SecureClipboardState>({ ...SECURE_CLIPBOARD_EMPTY_STATE });
  readonly formSnapshot = signal<SecureClipboardFormValues>(this.readFormValues());
  /** Drives remaining-seconds recompute under OnPush without changing TTL rules. */
  private readonly nowMs = signal(Date.now());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasStored = computed(() => this.state().stored !== null);

  readonly isExpired = computed(() =>
    isSecureClipboardExpired(this.state().expiresAt, this.nowMs())
  );

  readonly remainingSeconds = computed(() =>
    computeSecureClipboardRemainingSeconds(this.state().expiresAt, this.nowMs())
  );

  readonly canStore = computed(() => {
    const { text, password } = this.formSnapshot();
    return !!text.trim() && !!password;
  });

  readonly hasText = computed(() => !!this.formSnapshot().text);

  readonly statusLabel = computed(() =>
    resolveSecureClipboardStatusLabel(this.hasStored(), this.isExpired())
  );

  readonly expiresAtLabel = computed(() =>
    formatSecureClipboardExpiresAt(this.state().expiresAt)
  );

  readonly primarySuggestion = computed(() => {
    const snapshot = this.formSnapshot();
    const suggestion = resolveSecureClipboardSuggestion({
      hasText: !!snapshot.text.trim(),
      hasPassword: !!snapshot.password,
      hasStored: this.hasStored(),
      isActive: this.hasStored() && !this.isExpired(),
      ttlSeconds: snapshot.ttlSeconds,
      errorMessage: this.errors()[0] ?? null,
      warningMessage: this.warnings()[0] ?? null
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
    this.startTimer();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  async copyToSecureClipboard(): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);
    this.dismissedSuggestionId.set(null);

    const { text, password, ttlSeconds } = this.form.getRawValue();
    const validationErrors = validateSecureClipboardStore(text, password, ttlSeconds);
    if (validationErrors.length) {
      this.errors.set(validationErrors);
      return;
    }

    try {
      const encrypted = await stEncryptAesGcm(text, password);
      const expiresAt = Date.now() + ttlSeconds * 1000;
      this.state.set({ stored: encrypted, expiresAt });
      this.nowMs.set(Date.now());

      await navigator.clipboard.writeText(text);
      this.warnings.set([SECURE_CLIPBOARD_STORED_WARNING]);
    } catch (e) {
      this.errors.set([mapSecureClipboardError(e)]);
    }
  }

  clearClipboard(): void {
    this.state.set({ ...SECURE_CLIPBOARD_EMPTY_STATE });
    this.errors.set([]);
    this.warnings.set([]);
    this.dismissedSuggestionId.set(null);
    this.toast.info('Secure store cleared');
  }

  clearText(): void {
    this.form.controls.text.setValue('');
    this.toast.info('Text cleared');
  }

  async copyText(): Promise<void> {
    const text = this.form.controls.text.value;
    if (!text) {
      return;
    }
    await stCopyText(this.toast, text, 'Text');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private startTimer(): void {
    this.intervalId = window.setInterval(() => {
      this.nowMs.set(Date.now());
      const current = this.state();
      if (current.expiresAt && Date.now() >= current.expiresAt) {
        this.state.set({ ...SECURE_CLIPBOARD_EMPTY_STATE });
        this.warnings.set([SECURE_CLIPBOARD_EXPIRED_WARNING]);
      }
    }, SECURE_CLIPBOARD_TIMER_MS);
  }

  private stopTimer(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private readFormValues(): SecureClipboardFormValues {
    return this.form.getRawValue();
  }
}

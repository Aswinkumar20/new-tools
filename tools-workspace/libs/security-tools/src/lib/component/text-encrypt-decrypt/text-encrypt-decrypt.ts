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
import type { StRelatedToolLink } from '../../shared/st-tool-suggestion.model';
import { stCopyText } from '../../shared/st-clipboard.util';
import { stDecryptAesGcm, stEncryptAesGcm } from '../../shared/st-aes-gcm.util';
import {
  TEXT_ENCRYPT_DEFAULT_FORM,
  TEXT_ENCRYPT_EMPTY_STATE,
  TEXT_ENCRYPT_RELATED_TOOLS
} from '../../constants/text-encrypt-decrypt.constants';
import type {
  TextCryptoMode,
  TextCryptoState,
  TextEncryptDecryptFormGroup,
  TextEncryptDecryptFormValues
} from '../../types/text-encrypt-decrypt.types';
import {
  canRunTextCrypto,
  mapTextCryptoError,
  resolveTextCryptoInputLength,
  resolveTextEncryptDecryptSuggestion,
  toggleTextCryptoMode,
  validateTextCryptoOperation
} from '../../utils/text-encrypt-decrypt.utils';

@Component({
  selector: 'lib-text-encrypt-decrypt',
  standalone: true,
  templateUrl: './text-encrypt-decrypt.html',
  styleUrls: ['./text-encrypt-decrypt.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextEncryptDecryptComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly relatedTools: ReadonlyArray<StRelatedToolLink> = TEXT_ENCRYPT_RELATED_TOOLS;

  readonly form: TextEncryptDecryptFormGroup = this.fb.group({
    mode: this.fb.control<TextCryptoMode>(TEXT_ENCRYPT_DEFAULT_FORM.mode, {
      nonNullable: true
    }),
    plaintext: this.fb.control(TEXT_ENCRYPT_DEFAULT_FORM.plaintext, { nonNullable: true }),
    ciphertext: this.fb.control(TEXT_ENCRYPT_DEFAULT_FORM.ciphertext, { nonNullable: true }),
    password: this.fb.control(TEXT_ENCRYPT_DEFAULT_FORM.password, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly state = signal<TextCryptoState>({ ...TEXT_ENCRYPT_EMPTY_STATE });
  readonly formSnapshot = signal<TextEncryptDecryptFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasOutput = computed(() => !!this.state().output);

  readonly isEncryptMode = computed(() => this.formSnapshot().mode === 'encrypt');

  readonly inputLength = computed(() => {
    const snapshot = this.formSnapshot();
    return resolveTextCryptoInputLength(snapshot.mode, snapshot.plaintext, snapshot.ciphertext);
  });

  readonly canRun = computed(() => {
    const snapshot = this.formSnapshot();
    return canRunTextCrypto(
      snapshot.mode,
      snapshot.plaintext,
      snapshot.ciphertext,
      snapshot.password
    );
  });

  readonly primarySuggestion = computed(() => {
    const snapshot = this.formSnapshot();
    const suggestion = resolveTextEncryptDecryptSuggestion({
      mode: snapshot.mode,
      hasPassword: !!snapshot.password,
      hasPlaintext: !!snapshot.plaintext.trim(),
      hasCiphertext: !!snapshot.ciphertext.trim(),
      hasOutput: this.hasOutput(),
      lastAction: this.state().lastAction,
      errorMessage: this.errors()[0] ?? null
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

  async run(): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);
    this.dismissedSuggestionId.set(null);

    const { mode, plaintext, ciphertext, password } = this.form.getRawValue();
    const validationErrors = validateTextCryptoOperation({
      mode,
      plaintext,
      ciphertext,
      password
    });
    if (validationErrors.length) {
      this.errors.set(validationErrors);
      return;
    }

    try {
      if (mode === 'encrypt') {
        const encrypted = await stEncryptAesGcm(plaintext, password);
        this.form.controls.ciphertext.setValue(encrypted);
        this.state.set({ output: encrypted, lastAction: 'encrypt' });
      } else {
        const decrypted = await stDecryptAesGcm(ciphertext, password);
        this.form.controls.plaintext.setValue(decrypted);
        this.state.set({ output: decrypted, lastAction: 'decrypt' });
      }
    } catch (e) {
      this.errors.set([mapTextCryptoError(e)]);
    }
  }

  setMode(mode: TextCryptoMode): void {
    this.form.controls.mode.setValue(mode);
  }

  swapMode(): void {
    this.form.controls.mode.setValue(toggleTextCryptoMode(this.form.controls.mode.value));
  }

  clearAll(): void {
    this.form.controls.plaintext.setValue('');
    this.form.controls.ciphertext.setValue('');
    this.form.controls.password.setValue('');
    this.state.set({ ...TEXT_ENCRYPT_EMPTY_STATE });
    this.errors.set([]);
    this.warnings.set([]);
    this.dismissedSuggestionId.set(null);
    this.toast.info('Cleared');
  }

  async copyInput(): Promise<void> {
    const snapshot = this.formSnapshot();
    const text = snapshot.mode === 'encrypt' ? snapshot.plaintext : snapshot.ciphertext;
    const copied = await stCopyText(this.toast, text, 'Input');
    if (!copied && text) {
      this.errors.set(['Failed to copy input to clipboard.']);
    }
  }

  async copyOutput(): Promise<void> {
    const output = this.state().output;
    const copied = await stCopyText(this.toast, output, 'Output');
    if (!copied && output) {
      this.errors.set(['Failed to copy output to clipboard.']);
    }
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private readFormValues(): TextEncryptDecryptFormValues {
    return this.form.getRawValue();
  }
}

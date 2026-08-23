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
  PRIVATE_NOTES_DEFAULT_FORM,
  PRIVATE_NOTES_EMPTY_STATE,
  PRIVATE_NOTES_RELATED_TOOLS
} from '../../constants/private-notes.constants';
import type {
  PrivateNotesFormGroup,
  PrivateNotesFormValues,
  PrivateNotesState
} from '../../types/private-notes.types';
import {
  formatPrivateNotesSavedTime,
  mapPrivateNotesCryptoError,
  resolvePrivateNotesStatusLabel,
  resolvePrivateNotesSuggestion,
  validatePrivateNotesDecrypt,
  validatePrivateNotesEncrypt
} from '../../utils/private-notes.utils';

@Component({
  selector: 'lib-private-notes',
  standalone: true,
  templateUrl: './private-notes.html',
  styleUrls: ['./private-notes.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivateNotesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly relatedTools: ReadonlyArray<StRelatedToolLink> = PRIVATE_NOTES_RELATED_TOOLS;

  readonly form: PrivateNotesFormGroup = this.fb.group({
    note: this.fb.control(PRIVATE_NOTES_DEFAULT_FORM.note, { nonNullable: true }),
    password: this.fb.control(PRIVATE_NOTES_DEFAULT_FORM.password, { nonNullable: true }),
    showNote: this.fb.control(PRIVATE_NOTES_DEFAULT_FORM.showNote, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly state = signal<PrivateNotesState>({ ...PRIVATE_NOTES_EMPTY_STATE });
  readonly formSnapshot = signal<PrivateNotesFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasEncrypted = computed(() => !!this.state().encrypted);
  readonly isLocked = computed(
    () => !!this.state().encrypted && !this.formSnapshot().note
  );

  readonly canEncrypt = computed(() => {
    const { note, password } = this.formSnapshot();
    return !!note.trim() && !!password;
  });

  readonly hasNote = computed(() => !!this.formSnapshot().note);
  readonly statusLabel = computed(() =>
    resolvePrivateNotesStatusLabel(this.hasEncrypted(), this.isLocked())
  );
  readonly lastSavedLabel = computed(() => formatPrivateNotesSavedTime(this.state().lastSavedAt));

  readonly primarySuggestion = computed(() => {
    const snapshot = this.formSnapshot();
    const suggestion = resolvePrivateNotesSuggestion({
      hasNote: !!snapshot.note.trim(),
      hasPassword: !!snapshot.password,
      passwordLength: snapshot.password.length,
      hasEncrypted: this.hasEncrypted(),
      isLocked: this.isLocked(),
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

  async encryptAndSave(): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);
    this.dismissedSuggestionId.set(null);

    const { note, password } = this.form.getRawValue();
    const validationErrors = validatePrivateNotesEncrypt(note, password);
    if (validationErrors.length) {
      this.errors.set(validationErrors);
      return;
    }

    try {
      const encrypted = await stEncryptAesGcm(note, password);
      this.state.set({
        encrypted,
        lastSavedAt: Date.now()
      });
      this.form.controls.note.setValue('');
      this.warnings.set(['Note encrypted and stored in memory for this session.']);
    } catch (e) {
      this.errors.set([mapPrivateNotesCryptoError('encrypt', e)]);
    }
  }

  async decrypt(): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);
    this.dismissedSuggestionId.set(null);

    const encrypted = this.state().encrypted;
    const password = this.form.controls.password.value;
    const validationErrors = validatePrivateNotesDecrypt(!!encrypted, password);
    if (validationErrors.length) {
      this.errors.set(validationErrors);
      return;
    }

    try {
      const note = await stDecryptAesGcm(encrypted!, password);
      this.form.controls.note.setValue(note);
      this.form.controls.showNote.setValue(true);
    } catch (e) {
      this.errors.set([mapPrivateNotesCryptoError('decrypt', e)]);
    }
  }

  clear(): void {
    this.form.controls.note.setValue('');
    this.errors.set([]);
    this.warnings.set([]);
    this.toast.info('Note text cleared');
  }

  clearAll(): void {
    this.form.controls.note.setValue('');
    this.form.controls.password.setValue('');
    this.form.controls.showNote.setValue(false);
    this.state.set({ ...PRIVATE_NOTES_EMPTY_STATE });
    this.errors.set([]);
    this.warnings.set([]);
    this.dismissedSuggestionId.set(null);
    this.toast.info('Private notes reset');
  }

  async copyNote(): Promise<void> {
    await stCopyText(this.toast, this.form.controls.note.value, 'Note');
  }

  async copyEncrypted(): Promise<void> {
    const enc = this.state().encrypted;
    if (!enc) {
      return;
    }
    await stCopyText(this.toast, enc, 'Encrypted blob');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private readFormValues(): PrivateNotesFormValues {
    const raw = this.form.getRawValue();
    return {
      note: raw.note,
      password: raw.password,
      showNote: raw.showNote
    };
  }
}

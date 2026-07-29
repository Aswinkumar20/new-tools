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
import {
  UUID_GENERATOR_DEFAULT_FORM,
  UUID_GENERATOR_RELATED_TOOLS
} from '../../constants/uuid-generator.constants';
import type {
  UuidEntry,
  UuidGeneratorFormGroup,
  UuidGeneratorFormValues
} from '../../types/uuid-generator.types';
import {
  generateUuidEntries,
  joinUuidValues,
  mergeUuidHistory,
  resolveUuidFormatLabel,
  resolveUuidSuggestion,
  shortenUuidDisplay
} from '../../utils/uuid-generator.utils';

@Component({
  selector: 'lib-uuid-generator',
  standalone: true,
  templateUrl: './uuid-generator.html',
  styleUrls: ['./uuid-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UuidGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly relatedTools: ReadonlyArray<StRelatedToolLink> = UUID_GENERATOR_RELATED_TOOLS;

  readonly form: UuidGeneratorFormGroup = this.fb.group({
    uppercase: this.fb.control(UUID_GENERATOR_DEFAULT_FORM.uppercase, { nonNullable: true }),
    withBraces: this.fb.control(UUID_GENERATOR_DEFAULT_FORM.withBraces, { nonNullable: true }),
    withHyphens: this.fb.control(UUID_GENERATOR_DEFAULT_FORM.withHyphens, { nonNullable: true }),
    count: this.fb.control(UUID_GENERATOR_DEFAULT_FORM.count, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly uuids = signal<UuidEntry[]>([]);
  readonly formSnapshot = signal<UuidGeneratorFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasUuids = computed(() => this.uuids().length > 0);
  readonly lastUuid = computed(() => (this.uuids().length ? this.uuids()[0].value : ''));
  readonly allUuidsText = computed(() => joinUuidValues(this.uuids()));
  readonly formatLabel = computed(() => resolveUuidFormatLabel(this.formSnapshot()));
  readonly lastUuidShort = computed(() => shortenUuidDisplay(this.lastUuid()));

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveUuidSuggestion({
      hasUuids: this.hasUuids(),
      uuidCount: this.uuids().length,
      batchCount: this.formSnapshot().count,
      withHyphens: this.formSnapshot().withHyphens,
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

  generate(): void {
    this.dismissedSuggestionId.set(null);
    const options = this.form.getRawValue();
    const { entries, errors } = generateUuidEntries(options);
    this.errors.set(errors);
    if (errors.length) {
      return;
    }
    this.uuids.set(mergeUuidHistory(entries, this.uuids()));
  }

  async copy(value: string): Promise<void> {
    if (!value) {
      return;
    }
    const copied = await stCopyText(this.toast, value, 'UUID');
    if (!copied) {
      this.errors.set(['Failed to copy UUID to clipboard.']);
    }
  }

  async copyAll(): Promise<void> {
    const text = this.allUuidsText();
    if (!text) {
      return;
    }
    const copied = await stCopyText(this.toast, text, 'All UUIDs');
    if (!copied) {
      this.errors.set(['Failed to copy UUIDs to clipboard.']);
    }
  }

  clearList(): void {
    this.uuids.set([]);
    this.errors.set([]);
    this.dismissedSuggestionId.set(null);
    this.toast.info('UUID list cleared');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private readFormValues(): UuidGeneratorFormValues {
    return this.form.getRawValue();
  }
}

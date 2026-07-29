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
  USER_AGENT_DEFAULT_FORM,
  USER_AGENT_RELATED_TOOLS
} from '../../constants/user-agent-parser.constants';
import type {
  ParsedUserAgent,
  UserAgentFormGroup,
  UserAgentFormValues
} from '../../types/user-agent-parser.types';
import {
  buildParsedUserAgentCopyText,
  parseUserAgentInput,
  resolveUserAgentSuggestion
} from '../../utils/user-agent-parser.utils';

@Component({
  selector: 'lib-user-agent-parser',
  standalone: true,
  templateUrl: './user-agent-parser.html',
  styleUrls: ['./user-agent-parser.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserAgentParserComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly relatedTools: ReadonlyArray<TtRelatedToolLink> = USER_AGENT_RELATED_TOOLS;

  readonly form: UserAgentFormGroup = this.fb.group({
    userAgent: this.fb.control(USER_AGENT_DEFAULT_FORM.userAgent, { nonNullable: true }),
    useCurrent: this.fb.control(USER_AGENT_DEFAULT_FORM.useCurrent, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly parsed = signal<ParsedUserAgent | null>(null);
  readonly formSnapshot = signal<UserAgentFormValues>(USER_AGENT_DEFAULT_FORM);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasParsed = computed(() => this.parsed() !== null);
  readonly hasInput = computed(() => !!this.formSnapshot().userAgent.trim());

  readonly primarySuggestion = computed(() => {
    const current = this.parsed();
    const suggestion = resolveUserAgentSuggestion({
      hasInput: this.hasInput(),
      hasParsed: this.hasParsed(),
      errorMessage: this.errors()[0] ?? null,
      isBot: current?.isBot ?? false,
      deviceType: current?.deviceType ?? null,
      browser: current?.browser ?? null,
      os: current?.os ?? null
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formSnapshot.set(this.form.getRawValue());
    });
    this.populateCurrentUA();
  }

  onInputChange(): void {
    this.formSnapshot.set(this.form.getRawValue());
    if (this.hasInput()) {
      this.parse();
    } else {
      this.parsed.set(null);
      this.errors.set([]);
    }
  }

  onUseCurrentChange(): void {
    this.formSnapshot.set(this.form.getRawValue());
    if (this.form.controls.useCurrent.value) {
      this.populateCurrentUA();
    }
  }

  clear(): void {
    this.form.controls.userAgent.setValue('');
    this.form.controls.useCurrent.setValue(false);
    this.parsed.set(null);
    this.errors.set([]);
    this.warnings.set([]);
    this.dismissedSuggestionId.set(null);
    this.formSnapshot.set(this.form.getRawValue());
    this.toast.info('Cleared');
  }

  async copyInput(): Promise<void> {
    await ttCopyText(this.toast, this.form.controls.userAgent.value, 'User agent');
  }

  async copyOutput(): Promise<void> {
    const current = this.parsed();
    if (!current) {
      return;
    }
    await ttCopyText(this.toast, buildParsedUserAgentCopyText(current), 'Parsed details');
  }

  populateCurrentUA(): void {
    if (typeof navigator !== 'undefined' && this.form.controls.useCurrent.value) {
      this.form.controls.userAgent.setValue(navigator.userAgent);
      this.formSnapshot.set(this.form.getRawValue());
      this.parse();
    }
  }

  parse(): void {
    this.dismissedSuggestionId.set(null);
    const { parsed, errors, warnings } = parseUserAgentInput(
      this.form.controls.userAgent.value
    );
    this.errors.set(errors);
    this.warnings.set(warnings);
    this.parsed.set(parsed);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }
}

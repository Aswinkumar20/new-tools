import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ddCopyText } from '../../shared/dd-clipboard.util';
import type { DdRelatedToolLink } from '../../shared/dd-tool-suggestion.model';
import {
  RESPONSIVE_COMMON_BREAKPOINTS,
  RESPONSIVE_DEFAULT_HEIGHT,
  RESPONSIVE_DEFAULT_URL,
  RESPONSIVE_DEFAULT_WIDTH,
  RESPONSIVE_HEIGHT_MAX,
  RESPONSIVE_HEIGHT_MIN,
  RESPONSIVE_IFRAME_WARNING,
  RESPONSIVE_PRESET_BREAKPOINTS,
  RESPONSIVE_RELATED_TOOLS,
  RESPONSIVE_URL_PATTERN,
  RESPONSIVE_WIDTH_MAX,
  RESPONSIVE_WIDTH_MIN
} from '../../constants/responsive-breakpoint-tester.constants';
import type {
  ResponsiveActiveBreakpoint,
  ResponsiveBreakpointPreset
} from '../../types/responsive-breakpoint-tester.types';
import {
  buildGridMarks,
  findActiveBreakpoint,
  formatAspectRatio,
  formatBreakpointName,
  formatDimensionsText,
  getBreakpointColor,
  isOpenEndedBreakpoint,
  isValidHttpUrl,
  resolveResponsiveSuggestion,
  rotateViewport
} from '../../utils/responsive-breakpoint-tester.utils';

type ResponsiveTesterFormGroup = FormGroup<{
  url: FormControl<string>;
  width: FormControl<number>;
  height: FormControl<number>;
  showGrid: FormControl<boolean>;
  showRulers: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-responsive-breakpoint-tester',
  standalone: true,
  templateUrl: './responsive-breakpoint-tester.html',
  styleUrls: ['./responsive-breakpoint-tester.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResponsiveBreakpointTesterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly form: ResponsiveTesterFormGroup = this.fb.group({
    url: this.fb.control(RESPONSIVE_DEFAULT_URL, {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(RESPONSIVE_URL_PATTERN)]
    }),
    width: this.fb.control(RESPONSIVE_DEFAULT_WIDTH, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(RESPONSIVE_WIDTH_MIN),
        Validators.max(RESPONSIVE_WIDTH_MAX)
      ]
    }),
    height: this.fb.control(RESPONSIVE_DEFAULT_HEIGHT, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(RESPONSIVE_HEIGHT_MIN),
        Validators.max(RESPONSIVE_HEIGHT_MAX)
      ]
    }),
    showGrid: this.fb.control(false, { nonNullable: true }),
    showRulers: this.fb.control(false, { nonNullable: true })
  });

  readonly presetBreakpoints = RESPONSIVE_PRESET_BREAKPOINTS;
  readonly commonBreakpoints = RESPONSIVE_COMMON_BREAKPOINTS;
  readonly relatedTools: ReadonlyArray<DdRelatedToolLink> = RESPONSIVE_RELATED_TOOLS;
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly currentWidth = signal(RESPONSIVE_DEFAULT_WIDTH);
  readonly currentHeight = signal(RESPONSIVE_DEFAULT_HEIGHT);
  readonly safeIframeUrl = signal<SafeResourceUrl | null>(null);
  private readonly formTick = signal(0);
  private readonly hasCopiedDimensions = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly activeBreakpoint = computed(() => findActiveBreakpoint(this.currentWidth()));
  readonly aspectRatioLabel = computed(() =>
    formatAspectRatio(this.currentWidth(), this.currentHeight())
  );
  readonly iframeUrl = computed(() => {
    this.formTick();
    return this.safeIframeUrl();
  });
  readonly primarySuggestion = computed(() => {
    this.formTick();
    const suggestion = resolveResponsiveSuggestion({
      width: this.currentWidth(),
      height: this.currentHeight(),
      hasLoadedPreview: this.safeIframeUrl() !== null,
      hasCopiedDimensions: this.hasCopiedDimensions(),
      hasUrlError: this.errors().some((message) => message.includes('valid URL'))
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(100), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formTick.update((n) => n + 1);
        this.dismissedSuggestionId.set(null);
        this.hasCopiedDimensions.set(false);
        const { width, height } = this.form.getRawValue();
        this.currentWidth.set(width);
        this.currentHeight.set(height);
      });

    this.currentWidth.set(this.form.controls.width.value);
    this.currentHeight.set(this.form.controls.height.value);
    this.loadUrl();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  applyPreset(preset: ResponsiveBreakpointPreset): void {
    this.form.patchValue({
      width: preset.width,
      height: preset.height
    });
  }

  loadUrl(): void {
    this.errors.set([]);
    this.warnings.set([]);
    this.dismissedSuggestionId.set(null);
    this.hasCopiedDimensions.set(false);
    const url = this.form.controls.url.value?.trim() ?? '';

    if (!url || !isValidHttpUrl(url)) {
      this.errors.set(['Please enter a valid URL starting with http:// or https://']);
      this.safeIframeUrl.set(null);
      this.formTick.update((n) => n + 1);
      return;
    }

    this.safeIframeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    this.warnings.set([RESPONSIVE_IFRAME_WARNING]);
    this.formTick.update((n) => n + 1);
  }

  rotate(): void {
    const rotated = rotateViewport(this.form.getRawValue());
    this.form.patchValue(rotated);
  }

  reset(): void {
    this.hasCopiedDimensions.set(false);
    this.dismissedSuggestionId.set(null);
    this.form.patchValue({
      url: RESPONSIVE_DEFAULT_URL,
      width: RESPONSIVE_DEFAULT_WIDTH,
      height: RESPONSIVE_DEFAULT_HEIGHT,
      showGrid: false,
      showRulers: false
    });
    this.errors.set([]);
    this.loadUrl();
  }

  async copyDimensions(): Promise<void> {
    const text = formatDimensionsText(this.form.getRawValue());
    const ok = await ddCopyText(this.toast, text, 'Dimensions');
    if (ok) {
      this.hasCopiedDimensions.set(true);
      this.dismissedSuggestionId.set(null);
      this.errors.set([]);
      this.formTick.update((n) => n + 1);
    } else {
      this.errors.set(['Unable to copy dimensions to clipboard.']);
    }
  }

  formatBreakpointLabel(bp = this.activeBreakpoint()): string {
    return formatBreakpointName(bp);
  }

  breakpointColor(bp = this.activeBreakpoint()): string {
    return getBreakpointColor(bp);
  }

  isOpenEnded(bp: ResponsiveActiveBreakpoint): boolean {
    return isOpenEndedBreakpoint(bp);
  }

  getGridRows(): number[] {
    return buildGridMarks(this.currentHeight());
  }

  getGridCols(): number[] {
    return buildGridMarks(this.currentWidth());
  }
}

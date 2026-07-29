import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
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
  TIMEZONE_CATALOG,
  TIMEZONE_DEFAULT_TARGET,
  TIMEZONE_RELATED_TOOLS
} from '../../constants/timezone-converter.constants';
import { ftCopyText } from '../../shared/ft-clipboard.util';
import type { FtRelatedToolLink } from '../../shared/ft-tool-suggestion.model';
import type {
  TimezoneFormGroup,
  TimezoneFormValues,
  TimezoneOption
} from '../../types/timezone-converter.types';
import {
  absoluteTimezoneDiffHours,
  buildTimezoneConversion,
  detectBrowserTimezone,
  formatConversionOutputText,
  formatLocalDateTimeInput,
  resolveTimezoneSuggestion,
  swapTimezonePair
} from '../../utils/timezone-converter.utils';

@Component({
  selector: 'lib-timezone-converter',
  standalone: true,
  templateUrl: './timezone-converter.html',
  styleUrls: ['./timezone-converter.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimezoneConverterComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);
  private formSubscription?: Subscription;

  readonly form: TimezoneFormGroup = this.fb.group({
    dateTime: this.fb.control('', { nonNullable: true }),
    sourceTimezone: this.fb.control('', { nonNullable: true }),
    targetTimezone: this.fb.control('', { nonNullable: true })
  });

  readonly formSnapshot = signal<TimezoneFormValues>(this.form.getRawValue());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly timezones: ReadonlyArray<TimezoneOption> = TIMEZONE_CATALOG;
  readonly relatedTools: ReadonlyArray<FtRelatedToolLink> = TIMEZONE_RELATED_TOOLS;

  readonly convertedTime = computed(() =>
    buildTimezoneConversion(this.formSnapshot(), this.timezones)
  );

  readonly hasConversion = computed(() => this.convertedTime() !== null);

  readonly outputText = computed(() => {
    const conversion = this.convertedTime();
    return conversion ? formatConversionOutputText(conversion) : '';
  });

  readonly primarySuggestion = computed(() => {
    const snapshot = this.formSnapshot();
    let absoluteDiffHours = 0;
    if (snapshot.dateTime && snapshot.sourceTimezone && snapshot.targetTimezone) {
      const inputDate = new Date(snapshot.dateTime);
      if (!isNaN(inputDate.getTime())) {
        absoluteDiffHours = absoluteTimezoneDiffHours(
          inputDate,
          snapshot.sourceTimezone,
          snapshot.targetTimezone
        );
      }
    }

    const suggestion = resolveTimezoneSuggestion({
      sourceTimezone: snapshot.sourceTimezone,
      targetTimezone: snapshot.targetTimezone,
      hasConversion: this.hasConversion(),
      absoluteDiffHours
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.patchValue({
      dateTime: formatLocalDateTimeInput(),
      sourceTimezone: detectBrowserTimezone(),
      targetTimezone: TIMEZONE_DEFAULT_TARGET
    });
    this.formSnapshot.set(this.form.getRawValue());

    this.formSubscription = this.form.valueChanges.subscribe(() => {
      this.formSnapshot.set(this.form.getRawValue());
    });
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
  }

  useCurrentTime(): void {
    this.form.patchValue({ dateTime: formatLocalDateTimeInput() });
  }

  swapTimezones(): void {
    const { sourceTimezone, targetTimezone } = this.form.getRawValue();
    this.form.patchValue(swapTimezonePair(sourceTimezone, targetTimezone));
  }

  async copyOutput(): Promise<void> {
    await ftCopyText(this.toast, this.outputText(), 'Conversion');
  }

  async copyTargetTime(): Promise<void> {
    const conversion = this.convertedTime();
    if (!conversion) {
      return;
    }
    await ftCopyText(this.toast, conversion.target.time, 'Target time');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface Timezone {
  value: string;
  label: string;
  offset: string;
}

type TimezoneFormGroup = FormGroup<{
  dateTime: FormControl<string>;
  sourceTimezone: FormControl<string>;
  targetTimezone: FormControl<string>;
}>;

@Component({
  selector: 'lib-timezone-converter',
  standalone: true,
  templateUrl: './timezone-converter.html',
  styleUrls: ['./timezone-converter.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimezoneConverterComponent {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly form: TimezoneFormGroup = this.fb.group({
    dateTime: this.fb.control('', { nonNullable: true }),
    sourceTimezone: this.fb.control('', { nonNullable: true }),
    targetTimezone: this.fb.control('', { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);

  readonly timezones: Timezone[] = [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: 'UTC+0' },
    { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5/-4' },
    { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6/-5' },
    { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7/-6' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8/-7' },
    { value: 'Europe/London', label: 'London (GMT)', offset: 'UTC+0/+1' },
    { value: 'Europe/Paris', label: 'Paris (CET)', offset: 'UTC+1/+2' },
    { value: 'Europe/Berlin', label: 'Berlin (CET)', offset: 'UTC+1/+2' },
    { value: 'Europe/Rome', label: 'Rome (CET)', offset: 'UTC+1/+2' },
    { value: 'Europe/Madrid', label: 'Madrid (CET)', offset: 'UTC+1/+2' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam (CET)', offset: 'UTC+1/+2' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 'UTC+9' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)', offset: 'UTC+8' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)', offset: 'UTC+8' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: 'UTC+8' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: 'UTC+4' },
    { value: 'Asia/Kolkata', label: 'Mumbai/New Delhi (IST)', offset: 'UTC+5:30' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)', offset: 'UTC+10/+11' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEST)', offset: 'UTC+10/+11' },
    { value: 'America/Toronto', label: 'Toronto (EST)', offset: 'UTC-5/-4' },
    { value: 'America/Vancouver', label: 'Vancouver (PST)', offset: 'UTC-8/-7' },
    { value: 'America/Mexico_City', label: 'Mexico City (CST)', offset: 'UTC-6/-5' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)', offset: 'UTC-3/-2' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires (ART)', offset: 'UTC-3' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)', offset: 'UTC+2' },
    { value: 'Africa/Cairo', label: 'Cairo (EET)', offset: 'UTC+2/+3' },
    { value: 'Asia/Seoul', label: 'Seoul (KST)', offset: 'UTC+9' },
    { value: 'Asia/Bangkok', label: 'Bangkok (ICT)', offset: 'UTC+7' },
    { value: 'Asia/Jakarta', label: 'Jakarta (WIB)', offset: 'UTC+7' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST)', offset: 'UTC+12/+13' }
  ];

  readonly convertedTime = computed(() => {
    const { dateTime, sourceTimezone, targetTimezone } = this.form.getRawValue();
    if (!dateTime || !sourceTimezone || !targetTimezone) return null;
    try {
      const inputDate = new Date(dateTime);
      if (isNaN(inputDate.getTime())) return null;
      return {
        source: {
          time: this.formatTimeInTimezone(inputDate, sourceTimezone),
          timezone: this.getTimezoneLabel(sourceTimezone),
          offset: this.getTimezoneOffset(inputDate, sourceTimezone)
        },
        target: {
          time: this.formatTimeInTimezone(inputDate, targetTimezone),
          timezone: this.getTimezoneLabel(targetTimezone),
          offset: this.getTimezoneOffset(inputDate, targetTimezone)
        },
        difference: this.getTimeDifference(inputDate, sourceTimezone, targetTimezone)
      };
    } catch {
      return null;
    }
  });

  readonly hasConversion = computed(() => this.convertedTime() !== null);
  readonly outputText = computed(() => {
    const c = this.convertedTime();
    if (!c) return '';
    return [
      `Source: ${c.source.time} (${c.source.timezone}, ${c.source.offset})`,
      `Target: ${c.target.time} (${c.target.timezone}, ${c.target.offset})`,
      `Difference: ${c.difference}`
    ].join('\n');
  });

  constructor() {
    const now = new Date();
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    this.form.patchValue({
      dateTime: localDateTime,
      sourceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      targetTimezone: 'UTC'
    });
  }

  useCurrentTime(): void {
    const now = new Date();
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    this.form.patchValue({ dateTime: localDateTime });
  }

  swapTimezones(): void {
    const { sourceTimezone, targetTimezone } = this.form.getRawValue();
    this.form.patchValue({ sourceTimezone: targetTimezone, targetTimezone: sourceTimezone });
  }

  copyOutput(): void {
    this.copyText(this.outputText(), 'Conversion');
  }

  copyTargetTime(): void {
    const c = this.convertedTime();
    if (!c) return;
    this.copyText(c.target.time, 'Target time');
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    }).catch(() => {
      this.errors.set(['Failed to copy to clipboard.']);
    });
  }

  private formatTimeInTimezone(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(date);
  }

  private getTimezoneOffset(date: Date, timezone: string): string {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    const offsetMs = tzDate.getTime() - utcDate.getTime();
    const offsetHours = offsetMs / (1000 * 60 * 60);
    const sign = offsetHours >= 0 ? '+' : '-';
    const hours = Math.abs(Math.floor(offsetHours));
    const minutes = Math.abs(Math.floor((offsetHours % 1) * 60));
    return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  private getTimezoneLabel(value: string): string {
    return this.timezones.find((t) => t.value === value)?.label ?? value;
  }

  private getTimeDifference(date: Date, sourceTimezone: string, targetTimezone: string): string {
    const diffMs = this.getTimezoneOffsetMs(date, targetTimezone) - this.getTimezoneOffsetMs(date, sourceTimezone);
    const diffHours = Math.abs(diffMs / (1000 * 60 * 60));
    const hours = Math.floor(diffHours);
    const minutes = Math.floor((diffHours % 1) * 60);
    const sign = diffMs >= 0 ? '+' : '-';
    if (hours === 0) return `${sign}${minutes} minutes`;
    if (minutes === 0) return `${sign}${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    return `${sign}${hours}h ${minutes}m`;
  }

  private getTimezoneOffsetMs(date: Date, timezone: string): number {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    return tzDate.getTime() - utcDate.getTime();
  }
}

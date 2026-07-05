import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface UuidEntry {
  value: string;
  createdAt: number;
}

type UuidFormGroup = FormGroup<{
  uppercase: FormControl<boolean>;
  withBraces: FormControl<boolean>;
  withHyphens: FormControl<boolean>;
  count: FormControl<number>;
}>;

@Component({
  selector: 'lib-uuid-generator',
  standalone: true,
  templateUrl: './uuid-generator.html',
  styleUrls: ['./uuid-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UuidGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly form: UuidFormGroup = this.fb.group({
    uppercase: this.fb.control(false, { nonNullable: true }),
    withBraces: this.fb.control(false, { nonNullable: true }),
    withHyphens: this.fb.control(true, { nonNullable: true }),
    count: this.fb.control(1, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly uuids = signal<UuidEntry[]>([]);

  readonly hasUuids = computed(() => this.uuids().length > 0);
  readonly lastUuid = computed(() => (this.uuids().length ? this.uuids()[0].value : ''));

  readonly allUuidsText = computed(() => this.uuids().map((u) => u.value).join('\n'));

  formatLabel(): string {
    const { uppercase, withHyphens, withBraces } = this.form.getRawValue();
    const parts: string[] = [];
    if (withHyphens) parts.push('hyphen');
    if (uppercase) parts.push('upper');
    if (withBraces) parts.push('brace');
    return parts.length ? parts.join('+') : 'plain';
  }

  lastUuidShort(): string {
    const uuid = this.lastUuid();
    if (!uuid) return '—';
    return uuid.length > 12 ? `${uuid.slice(0, 8)}…` : uuid;
  }

  generate(): void {
    this.errors.set([]);
    const { uppercase, withBraces, withHyphens, count } = this.form.getRawValue();

    if (count < 1 || count > 50) {
      this.errors.set(['Count must be between 1 and 50.']);
      return;
    }

    const items: UuidEntry[] = [];
    for (let i = 0; i < count; i++) {
      let uuid = this.createUuid();

      if (!withHyphens) {
        uuid = uuid.replace(/-/g, '');
      }
      if (uppercase) {
        uuid = uuid.toUpperCase();
      }
      if (withBraces) {
        uuid = `{${uuid}}`;
      }

      items.push({ value: uuid, createdAt: Date.now() });
    }

    this.uuids.set([...items, ...this.uuids()].slice(0, 100));
  }

  copy(value: string): void {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      alert('UUID copied to clipboard!');
    }).catch(() => {
      this.errors.set(['Failed to copy UUID to clipboard.']);
    });
  }

  copyAll(): void {
    const text = this.allUuidsText();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert('All UUIDs copied to clipboard!');
    }).catch(() => {
      this.errors.set(['Failed to copy UUIDs to clipboard.']);
    });
  }

  clearList(): void {
    this.uuids.set([]);
    this.errors.set([]);
  }

  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  private createUuid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20)
    ].join('-');
  }
}

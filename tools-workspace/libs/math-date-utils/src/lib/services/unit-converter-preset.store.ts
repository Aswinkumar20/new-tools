import { signal, type Signal, type WritableSignal } from '@angular/core';
import type { ConversionPreset } from '../types/unit-converter.types';

export class PresetStore {
  private readonly entries: WritableSignal<ConversionPreset[]>;

  constructor(initial: ConversionPreset[] = []) {
    this.entries = signal([...initial]);
  }

  add(preset: Omit<ConversionPreset, 'id' | 'createdAt'>): void {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    this.entries.update((current) => [{ ...preset, id, createdAt }, ...current]);
  }

  remove(id: string): void {
    this.entries.update((current) => current.filter((preset) => preset.id !== id));
  }

  all(): Signal<ConversionPreset[]> {
    return this.entries.asReadonly();
  }
}

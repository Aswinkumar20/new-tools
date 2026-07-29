import { signal, type Signal, type WritableSignal } from '@angular/core';
import {
  UNIT_CONVERTER_HISTORY_LIMIT
} from '../constants/unit-converter.constants';
import type { ConversionResult } from '../types/unit-converter.types';

export class ConversionHistoryStore {
  private readonly maxEntries: number;
  private readonly entries: WritableSignal<ConversionResult[]>;

  constructor(limit = UNIT_CONVERTER_HISTORY_LIMIT) {
    this.maxEntries = limit;
    this.entries = signal<ConversionResult[]>([]);
  }

  push(result: ConversionResult): void {
    this.entries.update((current) => {
      const next = [
        result,
        ...current.filter(
          (entry) =>
            !(
              entry.inputValue === result.inputValue &&
              entry.inputUnit.id === result.inputUnit.id &&
              entry.outputUnit.id === result.outputUnit.id
            )
        )
      ];
      return next.slice(0, this.maxEntries);
    });
  }

  all(): Signal<ConversionResult[]> {
    return this.entries.asReadonly();
  }
}

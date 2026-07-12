import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { sortLines, SortMode } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-sort-lines',
  standalone: true,
  templateUrl: './sort-lines.html',
  styleUrls: ['./sort-lines.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class SortLinesComponent extends TextToolBase {
  sortMode: SortMode = 'az';
  caseSensitive = false;
  showOptionsPanel = false;

  readonly sortModes: { value: SortMode; label: string }[] = [
    { value: 'az', label: 'A → Z' },
    { value: 'za', label: 'Z → A' },
    { value: 'length-asc', label: 'Length ↑' },
    { value: 'length-desc', label: 'Length ↓' },
    { value: 'numeric', label: 'Numeric' },
  ];

  get lineCount(): number {
    if (!this.inputText) return 0;
    return this.inputText.split('\n').length;
  }

  get sortModeLabel(): string {
    return this.sortModes.find((m) => m.value === this.sortMode)?.label ?? this.sortMode;
  }

  setSortMode(mode: SortMode): void {
    if (this.sortMode === mode) return;
    this.sortMode = mode;
    this.onOptionsChange();
  }

  protected process(): void {
    this.outputText = sortLines(this.inputText, this.sortMode, this.caseSensitive);
  }
}

import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  SORT_LINES_DEFAULT_CASE_SENSITIVE,
  SORT_LINES_DEFAULT_MODE,
  SORT_LINES_MODE_OPTIONS,
  SORT_LINES_RELATED_TOOLS,
} from '../../constants/sort-lines.constants';
import type { SortMode, SortModeOption } from '../../types/sort-lines.types';
import {
  convertSortLinesText,
  countSortLines,
  inputHasDuplicateLines,
  inputLooksMostlyNumeric,
  resolveSortLinesSuggestion,
} from '../../utils/sort-lines.utils';

@Component({
  selector: 'lib-sort-lines',
  standalone: true,
  templateUrl: './sort-lines.html',
  styleUrls: ['./sort-lines.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class SortLinesComponent extends TextToolBase {
  sortMode: SortMode = SORT_LINES_DEFAULT_MODE;
  caseSensitive = SORT_LINES_DEFAULT_CASE_SENSITIVE;
  showOptionsPanel = false;

  readonly sortModes: ReadonlyArray<SortModeOption> = SORT_LINES_MODE_OPTIONS;
  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = SORT_LINES_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get lineCount(): number {
    return countSortLines(this.inputText);
  }

  get sortModeLabel(): string {
    return this.sortModes.find((m) => m.value === this.sortMode)?.label ?? this.sortMode;
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveSortLinesSuggestion({
      hasInput: this.hasInput,
      hasOutput: this.hasOutput,
      lineCount: this.lineCount,
      sortMode: this.sortMode,
      caseSensitive: this.caseSensitive,
      outputUnchanged: this.hasOutput && this.outputText === this.inputText,
      looksMostlyNumeric: inputLooksMostlyNumeric(this.inputText),
      hasDuplicateLines: inputHasDuplicateLines(this.inputText),
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  override onInputChange(): void {
    this.dismissedSuggestionId = null;
    super.onInputChange();
  }

  override onOptionsChange(): void {
    this.dismissedSuggestionId = null;
    super.onOptionsChange();
  }

  setSortMode(mode: SortMode): void {
    if (this.sortMode === mode) return;
    this.sortMode = mode;
    this.onOptionsChange();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  protected process(): void {
    this.outputText = convertSortLinesText({
      inputText: this.inputText,
      sortMode: this.sortMode,
      caseSensitive: this.caseSensitive,
    }).output;
  }
}

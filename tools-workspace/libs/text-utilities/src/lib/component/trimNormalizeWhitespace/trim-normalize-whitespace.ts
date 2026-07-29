import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  TRIM_NORMALIZE_DEFAULT_OPTIONS,
  TRIM_NORMALIZE_DEFAULT_SHOW_OPTIONS_PANEL,
  TRIM_NORMALIZE_RELATED_TOOLS,
} from '../../constants/trim-normalize-whitespace.constants';
import {
  convertTrimNormalizeText,
  countActiveTrimNormalizeOptions,
  inputHasCollapsedWhitespaceRuns,
  inputHasEmptyLines,
  inputHasLineEdgeWhitespace,
  inputHasNonLfLineEndings,
  resolveTrimNormalizeSuggestion,
} from '../../utils/trim-normalize-whitespace.utils';

@Component({
  selector: 'lib-trim-normalize-whitespace',
  standalone: true,
  templateUrl: './trim-normalize-whitespace.html',
  styleUrls: ['./trim-normalize-whitespace.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class TrimNormalizeWhitespaceComponent extends TextToolBase {
  trimLines = TRIM_NORMALIZE_DEFAULT_OPTIONS.trimLines;
  collapseSpaces = TRIM_NORMALIZE_DEFAULT_OPTIONS.collapseSpaces;
  removeEmptyLines = TRIM_NORMALIZE_DEFAULT_OPTIONS.removeEmptyLines;
  normalizeLineEndings = TRIM_NORMALIZE_DEFAULT_OPTIONS.normalizeLineEndings;
  showOptionsPanel = TRIM_NORMALIZE_DEFAULT_SHOW_OPTIONS_PANEL;

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = TRIM_NORMALIZE_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get activeOptionCount(): number {
    return countActiveTrimNormalizeOptions({
      trimLines: this.trimLines,
      collapseSpaces: this.collapseSpaces,
      removeEmptyLines: this.removeEmptyLines,
      normalizeLineEndings: this.normalizeLineEndings,
    });
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveTrimNormalizeSuggestion({
      hasInput: this.hasInput,
      hasOutput: this.hasOutput,
      outputUnchanged: this.hasOutput && this.outputText === this.inputText,
      trimLines: this.trimLines,
      collapseSpaces: this.collapseSpaces,
      removeEmptyLines: this.removeEmptyLines,
      normalizeLineEndings: this.normalizeLineEndings,
      hasLineEdgeWhitespace: inputHasLineEdgeWhitespace(this.inputText),
      hasCollapsedWhitespaceRuns: inputHasCollapsedWhitespaceRuns(this.inputText),
      hasEmptyLines: inputHasEmptyLines(this.inputText),
      hasNonLfLineEndings: inputHasNonLfLineEndings(this.inputText),
      activeOptionCount: this.activeOptionCount,
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  override onInputChange(): void {
    this.dismissedSuggestionId = null;
    super.onInputChange();
  }

  override onOptionsChange(): void {
    this.dismissedSuggestionId = null;
    super.onOptionsChange();
  }

  protected process(): void {
    this.outputText = convertTrimNormalizeText({
      inputText: this.inputText,
      trimLines: this.trimLines,
      collapseSpaces: this.collapseSpaces,
      removeEmptyLines: this.removeEmptyLines,
      normalizeLineEndings: this.normalizeLineEndings,
    }).output;
  }
}

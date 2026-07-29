import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  LINE_NUMBER_DEFAULT_MODE,
  LINE_NUMBER_DEFAULT_SEPARATOR,
  LINE_NUMBER_DEFAULT_START,
  LINE_NUMBER_RELATED_TOOLS
} from '../../constants/line-number-tool.constants';
import type { LineNumberMode } from '../../types/line-number-tool.types';
import {
  clampLineStartNumber,
  convertLineNumberText,
  countTextLines,
  inputLooksLikeNumberedLines,
  resolveLineNumberSuggestion
} from '../../utils/line-number-tool.utils';

@Component({
  selector: 'lib-line-number-tool',
  standalone: true,
  templateUrl: './line-number-tool.html',
  styleUrls: ['./line-number-tool.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective]
})
export class LineNumberToolComponent extends TextToolBase {
  mode: LineNumberMode = LINE_NUMBER_DEFAULT_MODE;
  startNumber = LINE_NUMBER_DEFAULT_START;
  separator = LINE_NUMBER_DEFAULT_SEPARATOR;
  showOptionsPanel = false;

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = LINE_NUMBER_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get modeLabel(): string {
    return this.mode === 'add' ? 'Add numbers' : 'Remove numbers';
  }

  get lineCount(): number {
    return countTextLines(this.inputText);
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveLineNumberSuggestion({
      mode: this.mode,
      hasInput: this.hasInput,
      hasOutput: this.hasOutput,
      lineCount: this.lineCount,
      inputLooksNumbered: inputLooksLikeNumberedLines(this.inputText)
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

  setMode(mode: LineNumberMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.onOptionsChange();
  }

  onStartNumberChange(): void {
    this.startNumber = clampLineStartNumber(this.startNumber);
    this.onOptionsChange();
  }

  protected process(): void {
    this.outputText = convertLineNumberText({
      mode: this.mode,
      inputText: this.inputText,
      startNumber: this.startNumber,
      separator: this.separator
    }).output;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }
}

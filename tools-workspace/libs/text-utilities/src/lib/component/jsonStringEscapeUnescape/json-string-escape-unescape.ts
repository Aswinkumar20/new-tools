import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  JSON_STRING_DEFAULT_MODE,
  JSON_STRING_RELATED_TOOLS
} from '../../constants/json-string-escape-unescape.constants';
import type { JsonStringConversionMode } from '../../types/json-string-escape-unescape.types';
import {
  convertJsonStringText,
  inputLooksLikeJsonEscaped,
  resolveJsonStringSuggestion
} from '../../utils/json-string-escape-unescape.utils';

@Component({
  selector: 'lib-json-string-escape-unescape',
  standalone: true,
  templateUrl: './json-string-escape-unescape.html',
  styleUrls: ['./json-string-escape-unescape.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective]
})
export class JsonStringEscapeUnescapeComponent extends TextToolBase {
  mode: JsonStringConversionMode = JSON_STRING_DEFAULT_MODE;

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = JSON_STRING_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get modeLabel(): string {
    return this.mode === 'encode' ? 'Escape' : 'Unescape';
  }

  get inputLabel(): string {
    return this.mode === 'encode' ? 'Source text' : 'JSON string escapes';
  }

  get outputLabel(): string {
    return this.mode === 'encode' ? 'Escaped output' : 'Plain text';
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveJsonStringSuggestion({
      mode: this.mode,
      hasInput: this.hasInput,
      hasOutput: this.hasOutput,
      errorMessage: this.errorMessage,
      inputLooksLikeEscaped: inputLooksLikeJsonEscaped(this.inputText)
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

  selectMode(selectedMode: JsonStringConversionMode): void {
    if (this.mode === selectedMode) return;
    const previousOutput = this.hasOutput ? this.outputText : '';
    this.mode = selectedMode;
    this.dismissedSuggestionId = null;
    if (previousOutput) {
      this.applyInputState(previousOutput);
      this.pushToUndoStack(previousOutput);
      this.toastService.info(`Switched to ${this.modeLabel} mode`);
      return;
    }
    if (this.inputText) {
      this.runProcess();
    } else {
      this.outputText = '';
      this.errorMessage = '';
    }
  }

  protected process(): void {
    const result = convertJsonStringText({
      mode: this.mode,
      inputText: this.inputText
    });
    this.outputText = result.output;
    this.errorMessage = result.errorMessage;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }
}

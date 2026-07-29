import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  MORSE_DEFAULT_MODE,
  MORSE_RELATED_TOOLS
} from '../../constants/morse-code-converter.constants';
import type { MorseConversionMode } from '../../types/morse-code-converter.types';
import {
  convertMorseText,
  inputLooksLikeMorse,
  resolveMorseSuggestion
} from '../../utils/morse-code-converter.utils';

@Component({
  selector: 'lib-morse-code-converter',
  standalone: true,
  templateUrl: './morse-code-converter.html',
  styleUrls: ['./morse-code-converter.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective]
})
export class MorseCodeConverterComponent extends TextToolBase {
  mode: MorseConversionMode = MORSE_DEFAULT_MODE;

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = MORSE_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get modeLabel(): string {
    return this.mode === 'encode' ? 'To Morse' : 'To text';
  }

  get inputLabel(): string {
    return this.mode === 'encode' ? 'Source text' : 'Morse code';
  }

  get outputLabel(): string {
    return this.mode === 'encode' ? 'Morse output' : 'Decoded text';
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveMorseSuggestion({
      mode: this.mode,
      hasInput: this.hasInput,
      hasOutput: this.hasOutput,
      inputLooksLikeMorse: inputLooksLikeMorse(this.inputText)
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

  selectMode(selectedMode: MorseConversionMode): void {
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
    this.outputText = convertMorseText({
      mode: this.mode,
      inputText: this.inputText
    }).output;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }
}

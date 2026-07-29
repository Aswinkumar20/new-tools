import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  HEX_DEFAULT_MODE,
  HEX_DEFAULT_SEPARATOR,
  HEX_RELATED_TOOLS,
  HEX_SEPARATOR_OPTIONS
} from '../../constants/hex-encode-decode.constants';
import type {
  HexConversionMode,
  HexSeparatorChoice,
  HexSeparatorOption
} from '../../types/hex-encode-decode.types';
import {
  convertHexText,
  inputLooksLikeHex,
  resolveHexSuggestion
} from '../../utils/hex-encode-decode.utils';

@Component({
  selector: 'lib-hex-encode-decode',
  standalone: true,
  templateUrl: './hex-encode-decode.html',
  styleUrls: ['./hex-encode-decode.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective]
})
export class HexEncodeDecodeComponent extends TextToolBase {
  mode: HexConversionMode = HEX_DEFAULT_MODE;
  separator: HexSeparatorOption = HEX_DEFAULT_SEPARATOR;

  readonly separatorOptions: ReadonlyArray<HexSeparatorChoice> = HEX_SEPARATOR_OPTIONS;
  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = HEX_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get modeLabel(): string {
    return this.mode === 'encode' ? 'Encode' : 'Decode';
  }

  get inputLabel(): string {
    return this.mode === 'encode' ? 'Source text' : 'Hex input';
  }

  get outputLabel(): string {
    return this.mode === 'encode' ? 'Hex output' : 'Decoded text';
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveHexSuggestion({
      mode: this.mode,
      hasInput: this.hasInput,
      hasOutput: this.hasOutput,
      errorMessage: this.errorMessage,
      inputLooksLikeHex: inputLooksLikeHex(this.inputText)
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

  selectMode(selectedMode: HexConversionMode): void {
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

  setSeparator(value: HexSeparatorOption): void {
    if (this.separator === value) return;
    this.separator = value;
    this.onOptionsChange();
  }

  protected process(): void {
    const result = convertHexText({
      mode: this.mode,
      inputText: this.inputText,
      separator: this.separator
    });
    this.outputText = result.output;
    this.errorMessage = result.errorMessage;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }
}

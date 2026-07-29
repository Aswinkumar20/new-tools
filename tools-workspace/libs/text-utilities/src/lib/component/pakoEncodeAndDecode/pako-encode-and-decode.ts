import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  PAKO_DEFAULT_ENCODING,
  PAKO_DEFAULT_FORMAT,
  PAKO_DEFAULT_LEVEL,
  PAKO_DEFAULT_MODE,
  PAKO_RELATED_TOOLS
} from '../../constants/pako-encode-and-decode.constants';
import type {
  PakoBinaryEncoding,
  PakoConversionMode,
  PakoFormat
} from '../../types/pako-encode-and-decode.types';
import {
  clampPakoCompressionLevel,
  convertPakoText,
  inputLooksLikePakoEncoded,
  pakoFormatLabel,
  resolvePakoSuggestion
} from '../../utils/pako-encode-and-decode.utils';

@Component({
  selector: 'lib-pako-encode-and-decode',
  standalone: true,
  templateUrl: './pako-encode-and-decode.html',
  styleUrls: ['./pako-encode-and-decode.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective]
})
export class PakoEncodeAndDecodeComponent extends TextToolBase {
  mode: PakoConversionMode = PAKO_DEFAULT_MODE;
  compressionFormat: PakoFormat = PAKO_DEFAULT_FORMAT;
  binaryEncoding: PakoBinaryEncoding = PAKO_DEFAULT_ENCODING;
  compressionLevel = PAKO_DEFAULT_LEVEL;

  inputBytes = 0;
  outputBytes = 0;
  compressionRatio = 0;

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = PAKO_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get modeLabel(): string {
    return this.mode === 'encode' ? 'Compress' : 'Decompress';
  }

  get formatLabel(): string {
    return pakoFormatLabel(this.compressionFormat);
  }

  get inputLabel(): string {
    return this.mode === 'encode' ? 'Source text' : `${this.binaryEncoding.toUpperCase()} input`;
  }

  get outputLabel(): string {
    return this.mode === 'encode'
      ? `${this.binaryEncoding.toUpperCase()} output`
      : 'Decompressed text';
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolvePakoSuggestion({
      mode: this.mode,
      hasInput: this.hasInput,
      hasOutput: this.hasOutput,
      errorMessage: this.errorMessage,
      binaryEncoding: this.binaryEncoding,
      compressionRatio: this.compressionRatio,
      inputLooksEncoded: inputLooksLikePakoEncoded(this.inputText, this.binaryEncoding)
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

  selectMode(selectedMode: PakoConversionMode): void {
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
      this.resetStats();
    }
  }

  setCompressionFormat(format: PakoFormat): void {
    if (this.compressionFormat === format) return;
    this.compressionFormat = format;
    this.onOptionsChange();
  }

  setBinaryEncoding(encoding: PakoBinaryEncoding): void {
    if (this.binaryEncoding === encoding) return;
    this.binaryEncoding = encoding;
    this.onOptionsChange();
  }

  onLevelChange(): void {
    this.compressionLevel = clampPakoCompressionLevel(this.compressionLevel);
    this.onOptionsChange();
  }

  protected override runProcess(): void {
    this.errorMessage = '';
    if (!this.inputText) {
      this.outputText = '';
      this.resetStats();
      return;
    }
    try {
      this.process();
    } catch (e) {
      this.outputText = '';
      this.resetStats();
      this.errorMessage = (e as Error).message || 'Compression failed.';
    }
  }

  protected process(): void {
    const result = convertPakoText({
      mode: this.mode,
      inputText: this.inputText,
      compressionFormat: this.compressionFormat,
      binaryEncoding: this.binaryEncoding,
      compressionLevel: this.compressionLevel
    });
    if (result.errorMessage) {
      throw new Error(result.errorMessage);
    }
    this.outputText = result.output;
    this.inputBytes = result.inputBytes;
    this.outputBytes = result.outputBytes;
    this.compressionRatio = result.compressionRatio;
  }

  protected override resetDerivedState(): void {
    this.resetStats();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  private resetStats(): void {
    this.inputBytes = 0;
    this.outputBytes = 0;
    this.compressionRatio = 0;
  }
}

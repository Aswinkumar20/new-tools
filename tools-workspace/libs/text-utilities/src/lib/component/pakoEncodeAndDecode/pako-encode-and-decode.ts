import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import {
  PakoBinaryEncoding,
  PakoFormat,
  pakoCompress,
  pakoDecompress,
} from '../../shared/pako-compression.utils';

@Component({
  selector: 'lib-pako-encode-and-decode',
  standalone: true,
  templateUrl: './pako-encode-and-decode.html',
  styleUrls: ['./pako-encode-and-decode.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class PakoEncodeAndDecodeComponent extends TextToolBase {
  mode: 'encode' | 'decode' = 'encode';
  compressionFormat: PakoFormat = 'deflate';
  binaryEncoding: PakoBinaryEncoding = 'base64';
  compressionLevel = 6;

  inputBytes = 0;
  outputBytes = 0;
  compressionRatio = 0;

  get modeLabel(): string {
    return this.mode === 'encode' ? 'Compress' : 'Decompress';
  }

  get formatLabel(): string {
    switch (this.compressionFormat) {
      case 'deflate':
        return 'Deflate';
      case 'deflateRaw':
        return 'Raw';
      case 'gzip':
        return 'Gzip';
      default:
        return this.compressionFormat;
    }
  }

  get inputLabel(): string {
    return this.mode === 'encode' ? 'Source text' : `${this.binaryEncoding.toUpperCase()} input`;
  }

  get outputLabel(): string {
    return this.mode === 'encode'
      ? `${this.binaryEncoding.toUpperCase()} output`
      : 'Decompressed text';
  }

  selectMode(selectedMode: 'encode' | 'decode'): void {
    if (this.mode === selectedMode) return;
    const previousOutput = this.hasOutput ? this.outputText : '';
    this.mode = selectedMode;
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
    this.compressionLevel = Math.min(9, Math.max(0, Math.round(this.compressionLevel)));
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
    if (this.mode === 'encode') {
      const result = pakoCompress(
        this.inputText,
        this.compressionFormat,
        this.binaryEncoding,
        this.compressionLevel,
      );
      this.outputText = result.output;
      this.inputBytes = result.inputBytes;
      this.outputBytes = result.outputBytes;
      this.compressionRatio = result.ratio;
    } else {
      this.outputText = pakoDecompress(
        this.inputText,
        this.compressionFormat,
        this.binaryEncoding,
      );
      this.inputBytes = 0;
      this.outputBytes = 0;
      this.compressionRatio = 0;
    }
  }

  private resetStats(): void {
    this.inputBytes = 0;
    this.outputBytes = 0;
    this.compressionRatio = 0;
  }
}

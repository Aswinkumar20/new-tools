import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { hexEncode, hexDecode } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-hex-encode-decode',
  standalone: true,
  templateUrl: './hex-encode-decode.html',
  styleUrls: ['./hex-encode-decode.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class HexEncodeDecodeComponent extends TextToolBase {
  mode: 'encode' | 'decode' = 'encode';
  separator: 'none' | 'space' | 'colon' = 'space';

  readonly separatorOptions = [
    { value: 'none' as const, label: 'None' },
    { value: 'space' as const, label: 'Space' },
    { value: 'colon' as const, label: 'Colon' },
  ];

  get modeLabel(): string {
    return this.mode === 'encode' ? 'Encode' : 'Decode';
  }

  get inputLabel(): string {
    return this.mode === 'encode' ? 'Source text' : 'Hex input';
  }

  get outputLabel(): string {
    return this.mode === 'encode' ? 'Hex output' : 'Decoded text';
  }

  private get separatorChar(): string {
    switch (this.separator) {
      case 'space': return ' ';
      case 'colon': return ':';
      default: return '';
    }
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
    }
  }

  setSeparator(value: 'none' | 'space' | 'colon'): void {
    if (this.separator === value) return;
    this.separator = value;
    this.onOptionsChange();
  }

  protected process(): void {
    this.outputText = this.mode === 'encode'
      ? hexEncode(this.inputText, this.separatorChar)
      : hexDecode(this.inputText);
  }
}

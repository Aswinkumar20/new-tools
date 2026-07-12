import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { urlEncode, urlDecode } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-url-encode-and-decode',
  standalone: true,
  templateUrl: './url-encode-and-decode.html',
  styleUrls: ['./url-encode-and-decode.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class UrlEncodeAndDecodeComponent extends TextToolBase {
  mode: 'encode' | 'decode' = 'encode';
  urlMode: 'component' | 'uri' = 'component';
  spaceAsPlus = false;
  plusAsSpace = true;

  get modeLabel(): string {
    return this.mode === 'encode' ? 'Encode' : 'Decode';
  }

  get inputLabel(): string {
    return this.mode === 'encode' ? 'Source text' : 'Encoded input';
  }

  get outputLabel(): string {
    return this.mode === 'encode' ? 'URL-encoded output' : 'Decoded text';
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

  setUrlMode(value: 'component' | 'uri'): void {
    if (this.urlMode === value) return;
    this.urlMode = value;
    this.onOptionsChange();
  }

  protected process(): void {
    if (this.mode === 'encode') {
      this.outputText = urlEncode(this.inputText, this.urlMode, this.spaceAsPlus);
    } else {
      this.outputText = urlDecode(this.inputText, this.plusAsSpace);
    }
  }
}

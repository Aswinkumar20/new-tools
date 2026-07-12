import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { splitText, joinText } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-split-join-text',
  standalone: true,
  templateUrl: './split-join-text.html',
  styleUrls: ['./split-join-text.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class SplitJoinTextComponent extends TextToolBase {
  mode: 'split' | 'join' = 'split';
  delimiter = ',';
  showOptionsPanel = false;

  get modeLabel(): string {
    return this.mode === 'split' ? 'Split' : 'Join';
  }

  setMode(mode: 'split' | 'join'): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.onOptionsChange();
  }

  protected process(): void {
    this.outputText =
      this.mode === 'split'
        ? splitText(this.inputText, this.delimiter)
        : joinText(this.inputText, this.delimiter);
  }
}

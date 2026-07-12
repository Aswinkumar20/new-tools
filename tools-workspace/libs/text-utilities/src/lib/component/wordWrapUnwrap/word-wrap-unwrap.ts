import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { wordWrap, wordUnwrap } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-word-wrap-unwrap',
  standalone: true,
  templateUrl: './word-wrap-unwrap.html',
  styleUrls: ['./word-wrap-unwrap.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class WordWrapUnwrapComponent extends TextToolBase {
  mode: 'wrap' | 'unwrap' = 'wrap';
  wrapWidth = 80;
  showOptionsPanel = false;

  get modeLabel(): string {
    return this.mode === 'wrap' ? 'Wrap' : 'Unwrap';
  }

  setMode(mode: 'wrap' | 'unwrap'): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.onOptionsChange();
  }

  onWrapWidthChange(): void {
    this.wrapWidth = Math.max(1, Math.min(500, Math.round(this.wrapWidth || 80)));
    this.onOptionsChange();
  }

  protected process(): void {
    this.outputText =
      this.mode === 'wrap'
        ? wordWrap(this.inputText, this.wrapWidth)
        : wordUnwrap(this.inputText);
  }
}

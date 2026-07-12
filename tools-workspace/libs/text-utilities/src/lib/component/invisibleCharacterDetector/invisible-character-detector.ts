import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import {
  annotateInvisibleChars,
  detectInvisibleChars,
  InvisibleCharHit,
} from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-invisible-character-detector',
  standalone: true,
  templateUrl: './invisible-character-detector.html',
  styleUrls: ['./invisible-character-detector.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class InvisibleCharacterDetectorComponent extends TextToolBase {
  invisibleHits: InvisibleCharHit[] = [];

  get invisibleCount(): number {
    return this.invisibleHits.length;
  }

  protected process(): void {
    this.invisibleHits = detectInvisibleChars(this.inputText);
    this.outputText = this.invisibleHits.length
      ? annotateInvisibleChars(this.inputText, this.invisibleHits)
      : '';
  }

  protected override resetDerivedState(): void {
    this.invisibleHits = [];
  }
}

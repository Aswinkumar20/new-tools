import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { rot13, caesarCipher } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-rot13-cipher',
  standalone: true,
  templateUrl: './rot13-cipher.html',
  styleUrls: ['./rot13-cipher.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class Rot13CipherComponent extends TextToolBase {
  cipherMode: 'rot13' | 'caesar' = 'rot13';
  caesarShift = 3;

  get cipherModeLabel(): string {
    return this.cipherMode === 'rot13' ? 'ROT13' : `Caesar ${this.caesarShift}`;
  }

  get decodeShift(): number {
    return ((26 - (this.caesarShift % 26)) + 26) % 26 || 26;
  }

  setCipherMode(mode: 'rot13' | 'caesar'): void {
    if (this.cipherMode === mode) return;
    this.cipherMode = mode;
    this.onOptionsChange();
  }

  onCaesarShiftChange(): void {
    if (this.caesarShift < 1) this.caesarShift = 1;
    if (this.caesarShift > 25) this.caesarShift = 25;
    this.onOptionsChange();
  }

  protected process(): void {
    this.outputText = this.cipherMode === 'rot13'
      ? rot13(this.inputText)
      : caesarCipher(this.inputText, this.caesarShift);
  }
}

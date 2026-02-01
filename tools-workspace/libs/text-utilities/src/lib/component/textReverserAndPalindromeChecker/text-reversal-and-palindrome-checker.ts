import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-text-reversal-and-palindrome-checker',
  standalone: true,
  templateUrl: './text-reversal-and-palindrome-checker.html',
  styleUrls: ['./text-reversal-and-palindrome-checker.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule],

})
export class TextReversalAndPalindromeCheckerComponent {
  readonly assetService = inject(AssetService);
  
  inputText: string = '';
  isPalindromeMode: boolean = true;
  resultText: string = '';
  palindromeStatus: boolean | null = null;
  copied = false;

  get normalizedLength(): number {
    if (!this.inputText) {
      return 0;
    }
    return this.inputText.toLowerCase().replace(/[\W_]/g, '').length;
  }

  get outputLength(): number {
    if (this.isPalindromeMode) {
      return this.inputText.length;
    }
    return this.resultText.length;
  }

  onInputChange() {
    if (this.isPalindromeMode) {
      this.checkPalindrome();
    } else {
      this.reverseText();
    }
  }

  toggleMode() {
    this.setMode(this.isPalindromeMode ? 'reverse' : 'palindrome');
  }

  setMode(mode: 'palindrome' | 'reverse') {
    const nextIsPalindrome = mode === 'palindrome';
    if (this.isPalindromeMode === nextIsPalindrome) {
      return;
    }
    this.isPalindromeMode = nextIsPalindrome;
    this.reset();
  }

  reset() {
    this.inputText = '';
    this.resultText = '';
    this.palindromeStatus = null;
    this.copied = false;
  }

  private reverseText() {
    this.resultText = this.inputText.split('').reverse().join('');
    this.palindromeStatus = null;
    this.copied = false;
  }

  private checkPalindrome() {
    const normalized = this.inputText.toLowerCase().replace(/[\W_]/g, '');
    const reversed = normalized.split('').reverse().join('');
    this.palindromeStatus = normalized.length > 0 && normalized === reversed;
    this.resultText = '';
    this.copied = false;
  }

  copyResult() {
    const value = this.isPalindromeMode ? this.inputText : this.resultText;
    if (!value) {
      return;
    }

    navigator.clipboard.writeText(value).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }
}

import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-text-reversal-and-palindrome-checker',
  standalone: true,
  templateUrl: './text-reversal-and-palindrome-checker.html',
  styleUrls: ['./text-reversal-and-palindrome-checker.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class TextReversalAndPalindromeCheckerComponent {
  readonly assetService = inject(AssetService);

  inputText = '';
  isPalindromeMode = true;
  resultText = '';
  palindromeStatus: boolean | null = null;

  get hasInput(): boolean {
    return !!this.inputText;
  }

  get normalizedLength(): number {
    if (!this.inputText) return 0;
    return this.inputText.toLowerCase().replace(/[\W_]/g, '').length;
  }

  get outputLength(): number {
    if (this.isPalindromeMode) return this.inputText.length;
    return this.resultText.length;
  }

  onInputChange(): void {
    if (this.isPalindromeMode) {
      this.checkPalindrome();
    } else {
      this.reverseText();
    }
  }

  setMode(mode: 'palindrome' | 'reverse'): void {
    const nextIsPalindrome = mode === 'palindrome';
    if (this.isPalindromeMode === nextIsPalindrome) return;
    this.isPalindromeMode = nextIsPalindrome;
    this.resultText = '';
    this.palindromeStatus = null;
    if (this.inputText) {
      this.onInputChange();
    }
  }

  reset(): void {
    this.inputText = '';
    this.resultText = '';
    this.palindromeStatus = null;
  }

  copyInput(): void {
    this.copyText(this.inputText, 'Input');
  }

  copyOutput(): void {
    this.copyText(this.resultText, 'Reversed text');
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }

  private reverseText(): void {
    this.resultText = this.inputText.split('').reverse().join('');
    this.palindromeStatus = null;
  }

  private checkPalindrome(): void {
    const normalized = this.inputText.toLowerCase().replace(/[\W_]/g, '');
    const reversed = normalized.split('').reverse().join('');
    this.palindromeStatus = normalized.length > 0 && normalized === reversed;
    this.resultText = '';
  }
}

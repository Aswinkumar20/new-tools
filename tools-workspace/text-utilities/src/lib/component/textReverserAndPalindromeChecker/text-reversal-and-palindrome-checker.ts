import { Component } from '@angular/core';

@Component({
  selector: 'lib-text-reversal-and-palindrome-checker',
  standalone: false,
  templateUrl: './text-reversal-and-palindrome-checker.html',
  styleUrls: ['./text-reversal-and-palindrome-checker.scss'],
})
export class TextReversalAndPalindromeChecker {
  inputText: string = '';
  isPalindromeMode: boolean = true;
  resultText: string = '';
  palindromeStatus: boolean | null = null;

  onInputChange() {
    if (this.isPalindromeMode) {
      this.checkPalindrome();
    } else {
      this.reverseText();
    }
  }

  toggleMode() {
    this.isPalindromeMode = !this.isPalindromeMode;
    this.inputText = '';
    this.resultText = '';
    this.palindromeStatus = null;
  }

  private reverseText() {
    this.resultText = this.inputText.split('').reverse().join('');
    this.palindromeStatus = null;
  }

  private checkPalindrome() {
    const normalized = this.inputText.toLowerCase().replace(/[\W_]/g, '');
    const reversed = normalized.split('').reverse().join('');
    this.palindromeStatus = normalized.length > 0 && normalized === reversed;
    this.resultText = '';
  }
}

import { Component} from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-text-reversal-and-palindrome-checker',
  standalone: true,
  templateUrl: './text-reversal-and-palindrome-checker.html',
  styleUrls: ['./text-reversal-and-palindrome-checker.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule],

})
export class TextReversalAndPalindromeCheckerComponent {
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

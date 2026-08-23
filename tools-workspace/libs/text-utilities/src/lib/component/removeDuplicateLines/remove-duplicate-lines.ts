import { Component} from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation } from '@tools-workspace/features-home';


@Component({
  selector: 'lib-remove-duplicate-lines',
  standalone: true,
  templateUrl: './remove-duplicate-lines.html',
  styleUrls: ['./remove-duplicate-lines.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule],

})
export class RemoveDuplicateLinesComponent {
  inputText = '';
  outputText = '';
  highlightedInput = ''; // HTML string with duplicates highlighted
  duplicateCount = 0;
  copied = false;


  get wordCount(): number {
  return this.inputText
    ? this.inputText.trim().split(/\s+/).filter(w => w).length
    : 0;
  }


  // Process the current inputText to compute output, highlights and counts
  private processInput() {
    if (!this.inputText || !this.inputText.trim()) {
      this.outputText = '';
      this.highlightedInput = '';
      this.duplicateCount = 0;
      return;
    }

    const words = this.inputText.split(/\s+/).filter(w => w !== undefined && w !== null && w !== '');
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    this.outputText = words
      .filter(word => {
        const lower = word.toLowerCase();
        if (seen.has(lower)) {
          duplicates.add(lower);
          return false;
        }
        seen.add(lower);
        return true;
      })
      .join(' ');

    this.duplicateCount = duplicates.size;
    this.highlightedInput = words
      .map(word => (duplicates.has(word.toLowerCase()) ? `<mark>${word}</mark>` : word))
      .join(' ');
  }

  // Called when the user clicks the button — still supported
  removeDuplicates() {
    this.processInput();
    this.copied = false;
  }

  // Called live as the user types or pastes
  onInputChange(value: string) {
    this.inputText = value;
    this.processInput();
  }

copyOutput() {
  navigator.clipboard.writeText(this.outputText);
  this.copied = true;
  setTimeout(() => (this.copied = false), 2000);
}

  clear() {
    this.inputText = '';
    this.outputText = '';
    this.highlightedInput = '';
    this.duplicateCount = 0;
    this.copied = false;
  }
}

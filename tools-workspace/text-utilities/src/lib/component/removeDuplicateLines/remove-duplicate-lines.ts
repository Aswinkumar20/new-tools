import { Component } from '@angular/core';

@Component({
  selector: 'lib-remove-duplicate-lines',
  standalone: false,
  templateUrl: './remove-duplicate-lines.html',
  styleUrls: ['./remove-duplicate-lines.scss'],
})
export class RemoveDuplicateLines {
  inputText = '';
  outputText = '';
  highlightedInput = ''; // HTML string with duplicates highlighted

  removeDuplicates() {
    const words = this.inputText.match(/\S+/g) || [];

    const seen = new Set<string>();
    const uniqueWords = [];
    const highlightedWords = [];

    for (const word of words) {
      if (!seen.has(word)) {
        seen.add(word);
        uniqueWords.push(word);
        highlightedWords.push(word);
      } else {
        // wrap duplicates with <mark> tag
        highlightedWords.push(`<mark>${word}</mark>`);
      }
    }

    this.outputText = uniqueWords.join(' ');
    // Join with space but keep the original spacing by using a simple approach:
    this.highlightedInput = highlightedWords.join(' ');
  }

  clear() {
    this.inputText = '';
    this.outputText = '';
    this.highlightedInput = '';
  }
}

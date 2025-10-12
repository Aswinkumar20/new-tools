import { Component, OnInit } from '@angular/core';
import { debounceTime } from 'rxjs/operators';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation } from '@tools-workspace/features-home';
@Component({
  selector: 'lib-words-and-character-counter',
  standalone: true,
  templateUrl: './wordsAndCharacterCounter.component.html',
  styleUrl: './wordsAndCharacterCounter.component.scss',
  imports:[FormsModule, CommonModule, Navigation, ReactiveFormsModule]
})
export class WordsAndCharacterCounterComponent implements OnInit {
  paragraphControl = new FormControl('');
  showCharacterCount = true;

  wordCount = 0;
  charCount = 0;
  charCountNoSpaces = 0;
  sentenceCount = 0;
  paragraphCount = 0;
  wordFrequency = [
    { word: 'tool', count: 3 },
    { word: 'pro', count: 2 },
    // ...
  ];
  readabilityScore = 0;
  copyIcon:any = '';

  ngOnInit(): void {
    // Initial calculation
    this.updateCounts(this.paragraphControl.value || '');
    this.copyIcon = 'icons/copy-icon.svg';
  }

  updateCounts(text: string): void {
    const trimmed = text.trim();

    // Word count
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    this.wordCount = words.length;

    // Character counts
    this.charCount = text.length;
    this.charCountNoSpaces = text.replace(/\s/g, '').length;

    // Sentence count: split by . ! ? followed by space or end of string
    const sentences = trimmed
      ? trimmed.split(/[\.\!\?]+(?:\s|$)/).filter(s => s.trim().length > 0)
      : [];
    this.sentenceCount = sentences.length;

    // Paragraph count: split by two or more newlines, or single newlines if double not found
    this.paragraphCount = trimmed
      ? trimmed.split(/\n{2,}/).filter(p => p.trim().length > 0).length
      : 0;

    // Readability score (Flesch Reading Ease)
    const syllableCount = this.countSyllables(trimmed);
    this.readabilityScore = this.calculateFleschReadingEase(
      this.wordCount,
      this.sentenceCount,
      syllableCount
    );
  }

  // Basic syllable count for English words
  countSyllables(text: string): number {
    if (!text) return 0;
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    let syllables = 0;
    for (const word of words) {
      // Remove non-alpha chars
      const clean = word.replace(/[^a-z]/g, '');
      if (!clean) continue;
      // Count vowel groups as syllables
      const syl = clean.match(/[aeiouy]{1,2}/g);
      syllables += syl ? syl.length : 1;
    }
    return syllables;
  }

  calculateFleschReadingEase(words: number, sentences: number, syllables: number): number {
    if (words === 0 || sentences === 0) return 0;
    // Flesch Reading Ease formula
    const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
    return Math.round(score * 10) / 10; // one decimal
  }

  copyText(): void {
    navigator.clipboard.writeText(this.paragraphControl.value || '').then(() => {
      alert('Text copied to clipboard!');
    });
  }

  clearText(): void {
    this.paragraphControl.setValue('');
  }
}

import { Component, OnInit, OnDestroy} from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-text-case-convertor',
  standalone: true,
  templateUrl: './text-case-convertor.html',
  styleUrls: ['./text-case-convertor.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],

})
export class TextCaseConvertorComponent implements OnInit, OnDestroy {
  inputText = '';
  convertedText = '';
  selectedCase:
    // Standard Cases
    | 'upper'
    | 'lower'
    | 'title'
    | 'sentence'
    | 'toggle'
    // Programming Cases
    | 'camel'
    | 'pascal'
    | 'snake'
    | 'upperSnake'
    | 'kebab'
    | 'train'
    | 'dot'
    | 'path'
    | 'constant'
    | 'macro'
    | 'camelSnake'
    | 'pascalSnake'
    | 'dotPascal'
    // Fun & Stylistic Cases
    | 'alternating'
    | 'studly'
    | 'reversed'
    | 'vowelUpper'
    | 'consonantUpper'
    | 'leet'
    | 'fullwidth'
    | 'smallCaps'
    | 'upsideDown'
    | 'mixed'
    | 'bracketed' = 'upper';

  charCount = 0;
  wordCount = 0;

  undoStack: string[] = [''];
  redoStack: string[] = [];

  ngOnInit(): void {
    // Component initialization - tooltips handled by directive
  }

  ngOnDestroy(): void {
    // Cleanup - tooltips handled by directive
  }

  onInputChange(value: string) {
    this.inputText = value;
    this.pushToUndoStack(value);
    this.convertedText = this.convertText(value);
    this.updateCounts(value);
  }

  onCaseChange(caseType: typeof this.selectedCase) {
    this.selectedCase = caseType;
    this.convertedText = this.convertText(this.inputText);
  }

  convertText(value: string): string {
    const text = value.trim();

    switch (this.selectedCase) {
      // Standard Cases
      case 'upper':
        return text.toUpperCase();
      case 'lower':
        return text.toLowerCase();
      case 'title':
        return text.replace(/\w\S*/g, word =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        );
      case 'sentence':
        const sentences = text.toLowerCase().match(/[^.!?]+[.!?]*\s*/g) || [];
        return sentences
          .map(s => s.trim())
          .map(s => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' ');
      case 'toggle':
        return text
          .split('')
          .map(char => char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase())
          .join('');

      // Programming Cases
      case 'camel':
        return this.toCamelCase(text);
      case 'pascal':
        return this.toPascalCase(text);
      case 'snake':
        return this.toSnakeCase(text);
      case 'upperSnake':
        return this.toSnakeCase(text).toUpperCase();
      case 'kebab':
        return this.toKebabCase(text);
      case 'train':
        return this.toTrainCase(text);
      case 'dot':
        return this.toDotCase(text);
      case 'path':
        return this.toPathCase(text);
      case 'constant':
        return this.toConstantCase(text);
      case 'macro':
        return this.toMacroCase(text);
      case 'camelSnake':
        return this.toCamelSnakeCase(text);
      case 'pascalSnake':
        return this.toPascalSnakeCase(text);
      case 'dotPascal':
        return this.toDotPascalCase(text);

      // Fun & Stylistic Cases
      case 'alternating':
        return this.toAlternatingCase(text);
      case 'studly':
        return this.toStudlyCase(text);
      case 'reversed':
        return this.toReversedCase(text);
      case 'vowelUpper':
        return this.toVowelUpperCase(text);
      case 'consonantUpper':
        return this.toConsonantUpperCase(text);
      case 'leet':
        return this.toLeetSpeak(text);
      case 'fullwidth':
        return this.toFullwidthCase(text);
      case 'smallCaps':
        return this.toSmallCaps(text);
      case 'upsideDown':
        return this.toUpsideDown(text);
      case 'mixed':
        return this.toMixedCase(text);
      case 'bracketed':
        return this.toBracketedCase(text);
      default:
        return text;
    }
  }

  // Core utility functions
  private capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }

  private splitWords(text: string): string[] {
    return text.toLowerCase().split(/[\s_\-\.\/]+/);
  }

  // Standard case conversion functions
  private toCamelCase(text: string): string {
    const words = this.splitWords(text);
    return words[0] + words.slice(1).map(this.capitalize).join('');
  }

  private toPascalCase(text: string): string {
    return this.splitWords(text).map(this.capitalize).join('');
  }

  private toSnakeCase(text: string): string {
    return this.splitWords(text).join('_');
  }

  private toKebabCase(text: string): string {
    return this.splitWords(text).join('-');
  }

  // Extended programming cases
  private toTrainCase(text: string): string {
    return this.splitWords(text).map(this.capitalize).join('-');
  }

  private toDotCase(text: string): string {
    return this.splitWords(text).join('.');
  }

  private toPathCase(text: string): string {
    return this.splitWords(text).join('/');
  }

  private toConstantCase(text: string): string {
    return this.toSnakeCase(text).toUpperCase();
  }

  private toMacroCase(text: string): string {
    return this.toConstantCase(text);
  }

  private toCamelSnakeCase(text: string): string {
    return this.splitWords(text)
      .map((word, index) => index === 0 ? word : this.capitalize(word))
      .join('_');
  }

  private toPascalSnakeCase(text: string): string {
    return this.splitWords(text).map(this.capitalize).join('_');
  }

  private toDotPascalCase(text: string): string {
    return this.splitWords(text).map(this.capitalize).join('.');
  }

  // Fun & Stylistic cases
  private toAlternatingCase(text: string): string {
    return text.split('').map((char, i) => 
      i % 2 === 0 ? char.toLowerCase() : char.toUpperCase()
    ).join('');
  }

  private toStudlyCase(text: string): string {
    return text.split('').map(char => 
      Math.random() > 0.5 ? char.toUpperCase() : char.toLowerCase()
    ).join('');
  }

  private toReversedCase(text: string): string {
    return text.split('').reverse().join('');
  }

  private toVowelUpperCase(text: string): string {
    return text.split('').map(char => 
      'aeiouAEIOU'.includes(char) ? char.toUpperCase() : char.toLowerCase()
    ).join('');
  }

  private toConsonantUpperCase(text: string): string {
    return text.split('').map(char => 
      'aeiouAEIOU'.includes(char) ? char.toLowerCase() : char.toUpperCase()
    ).join('');
  }

  private toLeetSpeak(text: string): string {
    const leetMap: { [key: string]: string } = {
      'a': '4', 'e': '3', 'i': '1', 'o': '0', 'l': '1',
      's': '5', 't': '7', 'b': '8', 'g': '6', 'z': '2'
    };
    return text.toLowerCase().split('').map(char => 
      leetMap[char] || char
    ).join('');
  }

  private toFullwidthCase(text: string): string {
    return text.split('').map(char => {
      const code = char.charCodeAt(0);
      if ((code >= 33 && code <= 126)) {
        return String.fromCharCode(code + 0xFEE0);
      }
      return char;
    }).join('');
  }

  private toSmallCaps(text: string): string {
    const smallCapsMap: { [key: string]: string } = {
      'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ғ', 'g': 'ɢ',
      'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ',
      'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 's', 't': 'ᴛ', 'u': 'ᴜ',
      'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ'
    };
    return text.toLowerCase().split('').map(char => 
      smallCapsMap[char] || char
    ).join('');
  }

  private toUpsideDown(text: string): string {
    const upsideDownMap: { [key: string]: string } = {
      'a': 'ɐ', 'b': 'q', 'c': 'ɔ', 'd': 'p', 'e': 'ǝ', 'f': 'ɟ', 'g': 'ƃ',
      'h': 'ɥ', 'i': 'ᴉ', 'j': 'ɾ', 'k': 'ʞ', 'l': 'l', 'm': 'ɯ', 'n': 'u',
      'o': 'o', 'p': 'd', 'q': 'b', 'r': 'ɹ', 's': 's', 't': 'ʇ', 'u': 'n',
      'v': 'ʌ', 'w': 'ʍ', 'x': 'x', 'y': 'ʎ', 'z': 'z', '.': '˙', '[': ']',
      '(': ')', '{': '}', '?': '¿', '!': '¡', '\'': ',', '<': '>', '_': '‾'
    };
    return text.toLowerCase().split('').reverse().map(char => 
      upsideDownMap[char] || char
    ).join('');
  }

  private toMixedCase(text: string): string {
    let result = '';
    let capitalize = true;
    for (const char of text) {
      if (/[a-zA-Z]/.test(char)) {
        result += capitalize ? char.toUpperCase() : char.toLowerCase();
        capitalize = !capitalize;
      } else {
        result += char;
      }
    }
    return result;
  }

  private toBracketedCase(text: string): string {
    return `[${text}]`;
  }


  updateCounts(value: string) {
    this.charCount = value.length;
    this.wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  }

  pushToUndoStack(value: string) {
    if (this.undoStack.length === 0 || this.undoStack[this.undoStack.length - 1] !== value) {
      this.undoStack.push(value);
      if (this.undoStack.length > 100) this.undoStack.shift(); // limit size
      this.redoStack = [];
    }
  }

  undo() {
    if (this.undoStack.length > 1) {
      const last = this.undoStack.pop()!;
      this.redoStack.push(last);
      const prev = this.undoStack[this.undoStack.length - 1];
      this.inputText = prev;
      this.convertedText = this.convertText(prev);
      this.updateCounts(prev);
      this.saveToLocalStorage();
    }
  }

  redo() {
    if (this.redoStack.length > 0) {
      const next = this.redoStack.pop()!;
      this.inputText = next;
      this.convertedText = this.convertText(next);
      this.pushToUndoStack(next);
      this.updateCounts(next);
      this.saveToLocalStorage();
    }
  }

  reset() {
    this.inputText = '';
    this.convertedText = '';
    this.charCount = 0;
    this.wordCount = 0;
    this.undoStack = [''];
    this.redoStack = [];
    this.saveToLocalStorage();
  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.convertedText).then(() => {
      alert('Copied to clipboard!');
    });
  }

  downloadText() {
    const blob = new Blob([this.convertedText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'converted-text.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  saveToLocalStorage() {
    const state = {
      inputText: this.inputText,
      convertedText: this.convertedText,
      selectedCase: this.selectedCase,
      undoStack: this.undoStack,
      redoStack: this.redoStack,
      charCount: this.charCount,
      wordCount: this.wordCount,
    };
    localStorage.setItem('textCaseConvertorState', JSON.stringify(state));
  }

  loadFromLocalStorage() {
    const saved = localStorage.getItem('textCaseConvertorState');
    if (saved) {
      const state = JSON.parse(saved);
      this.inputText = state.inputText || '';
      this.convertedText = state.convertedText || '';
      this.selectedCase = state.selectedCase || 'upper';
      this.undoStack = state.undoStack || [''];
      this.redoStack = state.redoStack || [];
      this.charCount = state.charCount || 0;
      this.wordCount = state.wordCount || 0;
    }
  }
}

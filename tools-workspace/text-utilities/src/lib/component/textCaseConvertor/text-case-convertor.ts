import { Component, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'lib-text-case-convertor',
  standalone: false,
  templateUrl: './text-case-convertor.html',
  styleUrls: ['./text-case-convertor.scss'],
})
export class TextCaseConvertor implements OnInit, OnDestroy {
  inputText = '';
  convertedText = '';
  selectedCase:
    | 'upper'
    | 'lower'
    | 'title'
    | 'sentence'
    | 'toggle'
    | 'camel'
    | 'pascal'
    | 'snake'
    | 'kebab' = 'upper';

  charCount = 0;
  wordCount = 0;

  undoStack: string[] = [];
  redoStack: string[] = [];

  ngOnInit() {
    this.loadFromLocalStorage();
    if (this.inputText) {
      this.convertedText = this.convertText(this.inputText);
      this.updateCounts(this.inputText);
    } else {
      this.pushToUndoStack('');
    }
  }

  ngOnDestroy() {
    localStorage.removeItem('textCaseConvertorState');
  }

  onInputChange(value: string) {
    this.inputText = value;
    this.pushToUndoStack(value);
    this.convertedText = this.convertText(value);
    this.updateCounts(value);
    this.saveToLocalStorage();
  }

  onCaseChange(caseType: typeof this.selectedCase) {
    this.selectedCase = caseType;
    this.convertedText = this.convertText(this.inputText);
    this.saveToLocalStorage();
  }

  convertText(value: string): string {
    const text = value.trim();

    switch (this.selectedCase) {
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
          .map(char =>
            char === char.toUpperCase()
              ? char.toLowerCase()
              : char.toUpperCase()
          )
          .join('');

      case 'camel':
        return this.toCamelCase(text);

      case 'pascal':
        return this.toPascalCase(text);

      case 'snake':
        return this.toSnakeCase(text);

      case 'kebab':
        return this.toKebabCase(text);

      default:
        return text;
    }
  }

  toCamelCase(text: string): string {
    const words = text.toLowerCase().split(/[\s_\-]+/);
    return words[0] + words.slice(1).map(this.capitalize).join('');
  }

  toPascalCase(text: string): string {
    return text
      .toLowerCase()
      .split(/[\s_\-]+/)
      .map(this.capitalize)
      .join('');
  }

  toSnakeCase(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s\-]+/g, '_')
      .replace(/[^\w_]/g, '');
  }

  toKebabCase(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/[^\w\-]/g, '');
  }

  capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
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

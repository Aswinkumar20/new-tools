import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

type CaseId =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'toggle'
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
  | 'bracketed';

interface CasePreset {
  id: CaseId;
  label: string;
}

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
  selectedCase: CaseId = 'upper';

  charCount = 0;
  wordCount = 0;

  undoStack: string[] = [''];
  redoStack: string[] = [];

  activePresetTab: 'standard' | 'programming' | 'fun' = 'standard';

  readonly standardPresets: CasePreset[] = [
    { id: 'lower', label: 'lowercase' },
    { id: 'upper', label: 'UPPERCASE' },
    { id: 'sentence', label: 'Sentence case' },
    { id: 'title', label: 'Title Case' },
    { id: 'toggle', label: 'Toggle Case' },
  ];

  readonly programmingPresets: CasePreset[] = [
    { id: 'camel', label: 'camelCase' },
    { id: 'pascal', label: 'PascalCase' },
    { id: 'snake', label: 'snake_case' },
    { id: 'upperSnake', label: 'UPPER_SNAKE' },
    { id: 'kebab', label: 'kebab-case' },
    { id: 'train', label: 'Train-Case' },
    { id: 'dot', label: 'dot.case' },
    { id: 'path', label: 'path/case' },
    { id: 'constant', label: 'CONSTANT' },
    { id: 'macro', label: 'MACRO_CASE' },
    { id: 'camelSnake', label: 'camel_Snake' },
    { id: 'pascalSnake', label: 'Pascal_Snake' },
    { id: 'dotPascal', label: 'Dot.Pascal' },
  ];

  readonly funPresets: CasePreset[] = [
    { id: 'alternating', label: 'aLtErNaTiNg' },
    { id: 'studly', label: 'StUdLy CaPs' },
    { id: 'reversed', label: 'Reversed' },
    { id: 'vowelUpper', label: 'vOwEl UppEr' },
    { id: 'consonantUpper', label: 'CoNSoNaNT' },
    { id: 'leet', label: '1337 5P34K' },
    { id: 'fullwidth', label: 'Ｆｕｌｌｗｉｄｔｈ' },
    { id: 'smallCaps', label: 'sᴍᴀʟʟ ᴄᴀᴘs' },
    { id: 'upsideDown', label: 'uʍop ǝpᴉsd∩' },
    { id: 'mixed', label: 'MiXeD cAsE' },
    { id: 'bracketed', label: '[bracketed]' },
  ];

  readonly assetService = inject(AssetService);

  get canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get hasContent(): boolean {
    return this.inputText.trim().length > 0;
  }

  get selectedCaseLabel(): string {
    const all = [...this.standardPresets, ...this.programmingPresets, ...this.funPresets];
    return all.find((p) => p.id === this.selectedCase)?.label ?? this.selectedCase;
  }

  get activePresets(): CasePreset[] {
    switch (this.activePresetTab) {
      case 'programming':
        return this.programmingPresets;
      case 'fun':
        return this.funPresets;
      default:
        return this.standardPresets;
    }
  }

  setPresetTab(tab: 'standard' | 'programming' | 'fun'): void {
    this.activePresetTab = tab;
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(evt: KeyboardEvent): void {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const undoKey = isMac ? evt.metaKey && evt.key === 'z' && !evt.shiftKey : evt.ctrlKey && evt.key === 'z' && !evt.shiftKey;
    const redoKey = isMac
      ? evt.metaKey && (evt.key === 'y' || (evt.shiftKey && evt.key === 'z'))
      : evt.ctrlKey && (evt.key === 'y' || (evt.shiftKey && evt.key === 'z'));
    if (undoKey) {
      evt.preventDefault();
      this.undo();
    } else if (redoKey) {
      evt.preventDefault();
      this.redo();
    }
  }

  ngOnInit(): void {
    this.loadFromLocalStorage();
    if (this.inputText) {
      this.convertedText = this.convertText(this.inputText);
    }
    this.syncPresetTab();
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

  onCaseChange(caseType: CaseId) {
    this.selectedCase = caseType;
    this.convertedText = this.convertText(this.inputText);
    this.syncPresetTab();
  }

  private syncPresetTab(): void {
    if (this.programmingPresets.some((p) => p.id === this.selectedCase)) {
      this.activePresetTab = 'programming';
    } else if (this.funPresets.some((p) => p.id === this.selectedCase)) {
      this.activePresetTab = 'fun';
    } else {
      this.activePresetTab = 'standard';
    }
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

  copyInput(): void {
    this.copyText(this.inputText, 'Source');
  }

  copyOutput(): void {
    this.copyText(this.convertedText, 'Output');
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
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

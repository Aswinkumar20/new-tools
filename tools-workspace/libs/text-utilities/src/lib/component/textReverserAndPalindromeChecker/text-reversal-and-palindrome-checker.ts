import { Component, OnInit, OnDestroy, HostListener, inject, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { TextToolProcessingHost } from '../../shared/text-tool-processing-host';
import { TextToolProcessingOverlayComponent } from '../../shared/text-tool-processing-overlay.component';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  TEXT_REVERSAL_DEFAULT_MODE,
  TEXT_REVERSAL_MAX_UPLOAD_BYTES,
  TEXT_REVERSAL_RELATED_TOOLS,
  TEXT_REVERSAL_SAMPLES,
} from '../../constants/text-reversal-and-palindrome-checker.constants';
import type {
  TextReversalMode,
  TextReversalSample,
} from '../../types/text-reversal-and-palindrome-checker.types';
import {
  analyzeTextReversal,
  normalizeForPalindrome,
  resolveTextReversalSuggestion,
  reverseString,
} from '../../utils/text-reversal-and-palindrome-checker.utils';

@Component({
  selector: 'lib-text-reversal-and-palindrome-checker',
  standalone: true,
  templateUrl: './text-reversal-and-palindrome-checker.html',
  styleUrls: ['./text-reversal-and-palindrome-checker.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective, TextToolProcessingOverlayComponent],
})
export class TextReversalAndPalindromeCheckerComponent extends TextToolProcessingHost implements OnInit, OnDestroy {
  @ViewChild('inputTextarea') inputTextareaRef?: ElementRef<HTMLTextAreaElement>;

  readonly assetService = inject(AssetService);

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = TEXT_REVERSAL_RELATED_TOOLS;
  readonly samples: ReadonlyArray<TextReversalSample> = TEXT_REVERSAL_SAMPLES;
  private dismissedSuggestionId: string | null = null;

  inputText = '';
  isPalindromeMode = TEXT_REVERSAL_DEFAULT_MODE === 'palindrome';
  resultText = '';
  palindromeStatus: boolean | null = null;

  undoStack: string[] = [''];
  redoStack: string[] = [];
  private isRestoringHistory = false;
  private historyTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingHistoryValue = '';

  override maxUploadBytes = TEXT_REVERSAL_MAX_UPLOAD_BYTES;

  get hasInput(): boolean {
    return !!this.inputText?.trim();
  }

  get canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get currentMode(): TextReversalMode {
    return this.isPalindromeMode ? 'palindrome' : 'reverse';
  }

  get normalizedLength(): number {
    if (!this.inputText) return 0;
    return normalizeForPalindrome(this.inputText).length;
  }

  get outputLength(): number {
    if (this.isPalindromeMode) return this.inputText.length;
    return this.resultText.length;
  }

  get modeLabel(): string {
    return this.isPalindromeMode ? 'Palindrome' : 'Reverse';
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveTextReversalSuggestion({
      mode: this.currentMode,
      hasInput: this.hasInput,
      hasResult: !!this.resultText,
      palindromeStatus: this.palindromeStatus,
      normalizedLength: this.normalizedLength,
      inputEqualsReversed: !this.isPalindromeMode && this.inputText === this.resultText,
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(evt: KeyboardEvent): void {
    if (!this.isSourceEditorFocused()) {
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const key = evt.key.toLowerCase();
    const undoKey = isMac
      ? evt.metaKey && key === 'z' && !evt.shiftKey
      : evt.ctrlKey && key === 'z' && !evt.shiftKey;
    const redoKey = isMac
      ? evt.metaKey && (key === 'y' || (evt.shiftKey && key === 'z'))
      : evt.ctrlKey && (key === 'y' || (evt.shiftKey && key === 'z'));

    if (undoKey) {
      evt.preventDefault();
      this.undo();
    } else if (redoKey) {
      evt.preventDefault();
      this.redo();
    }
  }

  private isSourceEditorFocused(): boolean {
    const textarea = this.inputTextareaRef?.nativeElement;
    return !!textarea && document.activeElement === textarea;
  }

  ngOnInit(): void {
    this.seedHistory('');
  }

  override ngOnDestroy(): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
    }
    super.ngOnDestroy();
  }

  private seedHistory(value: string): void {
    this.undoStack = [value];
    this.redoStack = [];
  }

  onInputChange(): void {
    if (this.isRestoringHistory) {
      return;
    }
    this.scheduleDebouncedWork(() => this.runAnalysis(), this.inputText.length);
    this.scheduleHistoryPush(this.inputText);
  }

  private runAnalysis(): void {
    const analysis = analyzeTextReversal(this.inputText, this.currentMode);
    this.resultText = analysis.resultText;
    this.palindromeStatus = analysis.palindromeStatus;
  }

  setMode(mode: TextReversalMode): void {
    const nextIsPalindrome = mode === 'palindrome';
    if (this.isPalindromeMode === nextIsPalindrome) return;
    this.isPalindromeMode = nextIsPalindrome;
    this.resultText = '';
    this.palindromeStatus = null;
    if (this.inputText) {
      this.runAnalysis();
    }
  }

  clear(): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.applyInputState('');
    this.seedHistory('');
    this.toastService.info('Text cleared');
  }

  copyInput(): void {
    this.copyText(this.inputText, 'Input');
  }

  copyOutput(): void {
    if (this.isPalindromeMode) {
      this.copyPalindromeVerdict();
      return;
    }
    this.copyText(this.resultText, 'Reversed text');
  }

  copyPalindromeVerdict(): void {
    if (this.palindromeStatus === null) return;
    const verdict = this.palindromeStatus ? 'Palindrome' : 'Not a palindrome';
    this.copyText(`${verdict}: ${this.inputText}`, 'Result');
  }

  downloadText(): void {
    if (!this.resultText) return;
    this.downloadContent(this.resultText, 'reversed.txt');
  }

  useOutputAsInput(): void {
    if (!this.resultText) {
      this.toastService.info('No output to use');
      return;
    }
    const next = this.resultText;
    this.applyInputState(next);
    this.pushToUndoStack(next);
    this.toastService.info('Output moved to input');
  }

  swapInputOutput(): void {
    if (this.isPalindromeMode) {
      if (!this.inputText) {
        this.toastService.info('Nothing to reverse');
        return;
      }
      const reversed = reverseString(this.inputText);
      this.applyInputState(reversed);
      this.pushToUndoStack(reversed);
      this.toastService.info('Input reversed');
      return;
    }

    if (!this.resultText && !this.inputText) {
      this.toastService.info('Nothing to swap');
      return;
    }

    const tmp = this.inputText;
    this.applyInputState(this.resultText || '');
    this.resultText = tmp;
    this.toastService.info('Input and output swapped');
  }

  loadSample(text: string): void {
    this.applyInputState(text);
    this.pushToUndoStack(text);
    this.toastService.info('Sample loaded');
  }

  protected override onUploadedTextApplied(text: string): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.applyInputState(text);
    this.pushToUndoStack(text);
  }

  private scheduleHistoryPush(value: string): void {
    this.pendingHistoryValue = value;
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
    }
    const wait = value.length > 5000 ? 600 : value.length > 2000 ? 450 : 300;
    this.historyTimer = setTimeout(() => {
      if (!this.isRestoringHistory) {
        this.pushToUndoStack(this.pendingHistoryValue);
      }
      this.historyTimer = null;
    }, wait);
  }

  private applyInputState(value: string): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.pendingHistoryValue = value;
    this.isRestoringHistory = true;
    this.inputText = value;
    this.runAnalysis();
    this.isRestoringHistory = false;
  }

  pushToUndoStack(value: string): void {
    if (this.isRestoringHistory) {
      return;
    }
    const last = this.undoStack[this.undoStack.length - 1];
    if (last !== undefined && last === value) {
      return;
    }
    this.undoStack.push(value);
    if (this.undoStack.length > 100) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(): void {
    if (this.undoStack.length > 1) {
      const last = this.undoStack.pop()!;
      this.redoStack.push(last);
      const prev = this.undoStack[this.undoStack.length - 1];
      this.applyInputState(prev);
    }
  }

  redo(): void {
    if (this.redoStack.length > 0) {
      const next = this.redoStack.pop()!;
      this.undoStack.push(next);
      this.applyInputState(next);
    }
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.info(`${label} copied to clipboard`);
    }).catch(() => {
      this.toastService.error('Failed to copy to clipboard');
    });
  }
}

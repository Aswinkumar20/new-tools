import { Component, OnInit, OnDestroy, HostListener, inject, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, AssetService, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolProcessingHost } from '../../shared/text-tool-processing-host';
import { TextToolProcessingOverlayComponent } from '../../shared/text-tool-processing-overlay.component';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  TEXT_TO_ASCII_DEFAULT_LEFT,
  TEXT_TO_ASCII_DEFAULT_RIGHT,
  TEXT_TO_ASCII_FORMAT_OPTIONS,
  TEXT_TO_ASCII_MAX_UPLOAD_BYTES,
  TEXT_TO_ASCII_RELATED_TOOLS,
} from '../../constants/text-to-ascii.constants';
import type {
  TextToAsciiFormat,
  TextToAsciiFormatOption,
} from '../../types/text-to-ascii.types';
import {
  convertTextToAsciiFormats,
  inputLooksLikeAsciiCodes,
  inputLooksLikeBinaryCodes,
  inputLooksLikeHexCodes,
  resolveTextToAsciiSuggestion,
} from '../../utils/text-to-ascii.utils';

@Component({
  selector: 'lib-text-to-ascii',
  standalone: true,
  templateUrl: './text-to-ASCII.html',
  styleUrls: ['./text-to-ASCII.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective, TextToolProcessingOverlayComponent],
})
export class TextToASCIIComponent extends TextToolProcessingHost implements OnInit, OnDestroy {
  @ViewChild('inputTextarea') inputTextareaRef?: ElementRef<HTMLTextAreaElement>;

  inputValue = '';
  outputValue = '';
  errorMessage = '';
  isConverting = false;

  override maxUploadBytes = TEXT_TO_ASCII_MAX_UPLOAD_BYTES;

  leftType: TextToAsciiFormat = TEXT_TO_ASCII_DEFAULT_LEFT;
  rightType: TextToAsciiFormat = TEXT_TO_ASCII_DEFAULT_RIGHT;

  undoStack: string[] = [''];
  redoStack: string[] = [];
  private isRestoringHistory = false;
  private historyTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingHistoryValue = '';

  override get isProcessing(): boolean {
    return super.isProcessing || this.isConverting;
  }

  readonly assetService = inject(AssetService);

  readonly typeOptions: ReadonlyArray<TextToAsciiFormatOption> = TEXT_TO_ASCII_FORMAT_OPTIONS;
  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = TEXT_TO_ASCII_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get hasInput(): boolean {
    return !!this.inputValue?.trim();
  }

  get canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get fromLabel(): string {
    return this.typeOptions.find((o) => o.value === this.leftType)?.label ?? this.leftType;
  }

  get toLabel(): string {
    return this.typeOptions.find((o) => o.value === this.rightType)?.label ?? this.rightType;
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveTextToAsciiSuggestion({
      hasInput: this.hasInput,
      hasOutput: !!this.outputValue,
      hasError: !!this.errorMessage,
      leftType: this.leftType,
      rightType: this.rightType,
      inputLooksLikeAscii: inputLooksLikeAsciiCodes(this.inputValue),
      inputLooksLikeBinary: inputLooksLikeBinaryCodes(this.inputValue),
      inputLooksLikeHex: inputLooksLikeHexCodes(this.inputValue),
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
    this.cancelDebouncedWork();
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
    }
    super.ngOnDestroy();
  }

  private seedHistory(value: string): void {
    this.undoStack = [value];
    this.redoStack = [];
  }

  convert(): void {
    this.errorMessage = '';
    this.outputValue = '';
    this.isConverting = true;

    try {
      const result = convertTextToAsciiFormats({
        input: this.inputValue ?? '',
        leftType: this.leftType,
        rightType: this.rightType,
      });
      this.outputValue = result.output;
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : 'Invalid input for the selected conversion. Please check the format and try again.';
      this.errorMessage = message;
      this.outputValue = '';
    } finally {
      this.isConverting = false;
    }
  }

  onInputChange(): void {
    if (this.isRestoringHistory) {
      return;
    }

    this.dismissedSuggestionId = null;
    this.errorMessage = '';
    this.isConverting = true;

    this.scheduleDebouncedWork(() => {
      if (this.inputValue && this.inputValue.trim()) {
        this.convert();
      } else {
        this.outputValue = '';
        this.isConverting = false;
      }
    }, this.inputValue.length);

    this.scheduleHistoryPush(this.inputValue);
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
    this.cancelDebouncedWork();
    this.pendingHistoryValue = value;
    this.isRestoringHistory = true;
    this.inputValue = value;
    this.errorMessage = '';
    if (value.trim()) {
      this.isConverting = true;
      this.convert();
    } else {
      this.outputValue = '';
      this.isConverting = false;
    }
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

  onFormatChange(): void {
    this.dismissedSuggestionId = null;

    this.cancelDebouncedWork();

    this.errorMessage = '';

    if (this.inputValue && this.inputValue.trim()) {
      this.isConverting = true;
      this.convert();
    } else {
      this.outputValue = '';
      this.isConverting = false;
    }
  }

  swapTypes(): void {
    const tmpType = this.leftType;
    this.leftType = this.rightType;
    this.rightType = tmpType;

    const tmpValue = this.inputValue;
    this.inputValue = this.outputValue;
    this.outputValue = tmpValue;

    this.errorMessage = '';
    this.dismissedSuggestionId = null;

    this.cancelDebouncedWork();

    this.toastService.info('Formats swapped');

    if (this.inputValue && this.inputValue.trim()) {
      this.isConverting = true;
      setTimeout(() => this.convert(), 0);
    } else {
      this.outputValue = '';
      this.isConverting = false;
    }
  }

  useOutputAsInput(): void {
    if (!this.outputValue) {
      this.toastService.info('No output to use');
      return;
    }
    const next = this.outputValue;
    this.applyInputState(next);
    this.pushToUndoStack(next);
    this.toastService.info('Output moved to input');
  }

  getTypeDescription(type: string): string {
    const found = this.typeOptions.find((opt) => opt.value === type);
    return found ? found.description : '';
  }

  clear(): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.cancelDebouncedWork();
    this.applyInputState('');
    this.seedHistory('');
    this.errorMessage = '';
    this.isConverting = false;
    this.dismissedSuggestionId = null;
    this.toastService.info('Text cleared');
  }

  protected override onUploadedTextApplied(text: string): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.applyInputState(text);
    this.pushToUndoStack(text);
  }

  copyInput(): void {
    this.copyText(this.inputValue, 'Input');
  }

  copyOutput(): void {
    this.copyText(this.outputValue, 'Output');
  }

  downloadText(): void {
    if (!this.outputValue) return;
    const ext = this.rightType === 'text' ? 'txt' : this.rightType;
    this.downloadContent(this.outputValue, `output.${ext}`);
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

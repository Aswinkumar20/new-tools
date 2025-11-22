import { Component, OnInit, OnDestroy } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-text-to-ascii',
  standalone: true,
  templateUrl: './text-to-ASCII.html',
  styleUrls: ['./text-to-ASCII.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule],

})

export class TextToASCIIComponent implements OnInit, OnDestroy {
  inputValue: string = '';
  outputValue: string = '';
  errorMessage: string = '';
  copied = false;
  isConverting = false;

  // two separate selectors for input (left) and output (right)
  leftType: string = 'text';
  rightType: string = 'ascii';
  
  private convertTimer: any = null;
  private readonly DEBOUNCE_DELAY = 300; // milliseconds

typeOptions = [
  { value: 'text', label: 'Text', description: 'Plain readable text.' },
  { value: 'ascii', label: 'ASCII', description: 'ASCII codes representing each character.' },
  { value: 'binary', label: 'Binary', description: 'Binary representation (0s and 1s) of text.' },
  { value: 'hex', label: 'Hex', description: 'Hexadecimal representation of text.' }
];

  convert() {
    this.errorMessage = '';
    this.outputValue = '';
    this.copied = false;
    this.isConverting = true;

    try {
      // normalize null/undefined
      const raw = this.inputValue ?? '';

      // if same type, just pass through (no transformation)
      if (this.leftType === this.rightType) {
        this.outputValue = raw;
        return;
      }

      // first convert input (whatever it is) into plain text
      let text: string;
      switch (this.leftType) {
        case 'text':
          text = raw;
          break;
        case 'ascii':
          text = this.asciiToText(raw);
          break;
        case 'binary':
          text = this.binaryToText(raw);
          break;
        case 'hex':
          text = this.hexToText(raw);
          break;
        default:
          throw new Error('Invalid input type selected.');
      }

      // then convert text into desired output type
      switch (this.rightType) {
        case 'text':
          this.outputValue = text;
          break;
        case 'ascii':
          this.outputValue = this.textToAscii(text);
          break;
        case 'binary':
          this.outputValue = this.textToBinary(text);
          break;
        case 'hex':
          this.outputValue = this.textToHex(text);
          break;
        default:
          throw new Error('Invalid output type selected.');
      }
    } catch (e: any) {
      this.errorMessage = e?.message || 'Invalid input for the selected conversion.';
    } finally {
      this.isConverting = false;
    }
  }

  ngOnInit(): void {
    // Auto-convert on format change
    // Note: We'll handle input changes via onInputChange()
  }

  ngOnDestroy(): void {
    if (this.convertTimer) {
      clearTimeout(this.convertTimer);
    }
  }

  onInputChange(): void {
    // Clear any existing timer
    if (this.convertTimer) {
      clearTimeout(this.convertTimer);
    }

    // Clear previous error
    this.errorMessage = '';
    this.isConverting = true;

    // Debounce the conversion
    this.convertTimer = setTimeout(() => {
      if (this.inputValue && this.inputValue.trim()) {
        this.convert();
      } else {
        this.outputValue = '';
      }
      this.isConverting = false;
    }, this.DEBOUNCE_DELAY);
  }

  onFormatChange(): void {
    // Auto-convert when format changes
    if (this.inputValue && this.inputValue.trim()) {
      this.convert();
    }
  }

  swapTypes() {
    const tmp = this.leftType;
    this.leftType = this.rightType;
    this.rightType = tmp;
    if (this.inputValue) {
      this.convert();
    }
  }
  

  // helper to show guidance
  getTypeDescription(type: string): string {
    const found = this.typeOptions.find(opt => opt.value === type);
    return found ? found.description : '';
  }

  clearInput(): void {
    this.inputValue = '';
    this.outputValue = '';
    this.errorMessage = '';
    this.copied = false;
    if (this.convertTimer) {
      clearTimeout(this.convertTimer);
    }
    this.isConverting = false;
  }

  clear() {
    this.clearInput();
  }

  copyOutput() {
    try {
      if (!this.outputValue) return;
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(this.outputValue);
      } else {
        // fallback
        const textarea = document.createElement('textarea');
        textarea.value = this.outputValue;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch (e) {
      // ignore clipboard errors
    }
  }

  // Conversion Functions
  textToAscii(text: string): string {
    if (!text) return '';
    return text.split('').map(c => c.charCodeAt(0)).join(' ');
  }

  asciiToText(ascii: string): string {
    if (!ascii) return '';
    const parts = ascii.trim().split(/\s+/);
    if (!parts.every(p => /^\d+$/.test(p))) throw new Error('ASCII must be numbers separated by spaces.');
    return parts.map(p => String.fromCharCode(Number(p))).join('');
  }

  textToBinary(text: string): string {
    return text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
  }

  binaryToText(binary: string): string {
    const parts = binary.trim().split(/\s+/);
    if (!parts.every(b => /^[01]+$/.test(b))) throw new Error('Binary must contain only 0 and 1.');
    return parts.map(b => String.fromCharCode(parseInt(b, 2))).join('');
  }

  textToHex(text: string): string {
    return text.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
  }

  hexToText(hex: string): string {
    const parts = hex.trim().split(/\s+/);
    if (!parts.every(h => /^[0-9a-fA-F]+$/.test(h))) throw new Error('Hex must contain only 0-9 and A-F.');
    return parts.map(h => String.fromCharCode(parseInt(h, 16))).join('');
  }
}

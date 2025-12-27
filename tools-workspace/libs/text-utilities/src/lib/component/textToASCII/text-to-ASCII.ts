import { Component, OnInit, OnDestroy } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, ToastService } from '@tools-workspace/features-home';

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
  isConverting = false;

  // two separate selectors for input (left) and output (right)
  leftType: string = 'text';
  rightType: string = 'ascii';
  
  private convertTimer: any = null;
  private readonly DEBOUNCE_DELAY = 300; // milliseconds

  constructor(private toastService: ToastService) {}

typeOptions = [
  { value: 'text', label: 'Text', description: 'Plain readable text.' },
  { value: 'ascii', label: 'ASCII', description: 'ASCII codes representing each character.' },
  { value: 'binary', label: 'Binary', description: 'Binary representation (0s and 1s) of text.' },
  { value: 'hex', label: 'Hex', description: 'Hexadecimal representation of text.' }
];

  convert() {
    this.errorMessage = '';
    this.outputValue = '';
    this.isConverting = true;

    try {
      // normalize null/undefined
      const raw = this.inputValue ?? '';
      const trimmed = raw.trim();

      // Handle empty input
      if (!trimmed) {
        this.outputValue = '';
        this.isConverting = false;
        return;
      }

      // if same type, just pass through (no transformation)
      if (this.leftType === this.rightType) {
        this.outputValue = trimmed;
        this.isConverting = false;
        return;
      }

      // Validate types
      if (!this.isValidType(this.leftType) || !this.isValidType(this.rightType)) {
        throw new Error('Invalid conversion type selected.');
      }

      // first convert input (whatever it is) into plain text
      let text: string;
      switch (this.leftType) {
        case 'text':
          text = trimmed;
          break;
        case 'ascii':
          text = this.asciiToText(trimmed);
          break;
        case 'binary':
          text = this.binaryToText(trimmed);
          break;
        case 'hex':
          text = this.hexToText(trimmed);
          break;
        default:
          throw new Error('Invalid input type selected.');
      }

      // Validate that we got valid text
      if (text === null || text === undefined) {
        throw new Error('Failed to convert input to text. Please check your input format.');
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
      this.errorMessage = e?.message || 'Invalid input for the selected conversion. Please check the format and try again.';
      this.outputValue = '';
    } finally {
      this.isConverting = false;
    }
  }

  private isValidType(type: string): boolean {
    return this.typeOptions.some(opt => opt.value === type);
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
    // Clear any pending conversion timer
    if (this.convertTimer) {
      clearTimeout(this.convertTimer);
      this.convertTimer = null;
    }
    
    // Clear previous errors
    this.errorMessage = '';
    
    // Auto-convert when format changes
    if (this.inputValue && this.inputValue.trim()) {
      this.isConverting = true;
      this.convert();
    } else {
      // Clear output if no input
      this.outputValue = '';
      this.isConverting = false;
    }
  }

  swapTypes() {
    // Swap the types
    const tmpType = this.leftType;
    this.leftType = this.rightType;
    this.rightType = tmpType;
    
    // Swap the values - output becomes input, input becomes output
    const tmpValue = this.inputValue;
    this.inputValue = this.outputValue;
    this.outputValue = tmpValue;
    
    // Clear any previous errors
    this.errorMessage = '';
    
    // Clear any pending conversion timer
    if (this.convertTimer) {
      clearTimeout(this.convertTimer);
      this.convertTimer = null;
    }
    
    // Show toast notification
    this.toastService.info('Formats swapped successfully', 2000);
    
    // If there's input after swap, convert it
    if (this.inputValue && this.inputValue.trim()) {
      this.isConverting = true;
      // Use a small delay to ensure Angular has updated the bindings
      setTimeout(() => {
        this.convert();
      }, 0);
    } else {
      // Clear output if no input
      this.outputValue = '';
      this.isConverting = false;
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
      this.toastService.success('Copied to clipboard!', 2000);
    } catch (e) {
      this.toastService.error('Failed to copy to clipboard', 3000);
    }
  }

  // Conversion Functions
  textToAscii(text: string): string {
    if (!text) return '';
    return text.split('').map(c => c.charCodeAt(0)).join(' ');
  }

  asciiToText(ascii: string): string {
    if (!ascii || !ascii.trim()) {
      throw new Error('ASCII input cannot be empty.');
    }
    const trimmed = ascii.trim();
    const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length === 0) {
      throw new Error('ASCII input must contain at least one number.');
    }
    
    if (!parts.every(p => /^\d+$/.test(p))) {
      throw new Error('ASCII must contain only numbers separated by spaces (e.g., "72 101 108 108 111").');
    }
    
    // Validate ASCII range (0-255 for standard ASCII, but allow up to 65535 for extended)
    const invalidCodes = parts.filter(p => {
      const num = Number(p);
      return isNaN(num) || num < 0 || num > 65535;
    });
    
    if (invalidCodes.length > 0) {
      throw new Error(`Invalid ASCII code(s): ${invalidCodes.join(', ')}. Codes must be between 0 and 65535.`);
    }
    
    return parts.map(p => String.fromCharCode(Number(p))).join('');
  }

  textToBinary(text: string): string {
    return text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
  }

  binaryToText(binary: string): string {
    if (!binary || !binary.trim()) {
      throw new Error('Binary input cannot be empty.');
    }
    const trimmed = binary.trim();
    const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length === 0) {
      throw new Error('Binary input must contain at least one binary number.');
    }
    
    if (!parts.every(b => /^[01]+$/.test(b))) {
      throw new Error('Binary must contain only 0s and 1s, separated by spaces (e.g., "01001000 01100101").');
    }
    
    // Validate binary length (should be 8 bits per byte, but allow any length)
    try {
      return parts.map(b => {
        const charCode = parseInt(b, 2);
        if (isNaN(charCode) || charCode < 0 || charCode > 65535) {
          throw new Error(`Invalid binary value: ${b}`);
        }
        return String.fromCharCode(charCode);
      }).join('');
    } catch (e: any) {
      throw new Error(e.message || 'Invalid binary format. Each binary number should represent a valid character code.');
    }
  }

  textToHex(text: string): string {
    return text.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
  }

  hexToText(hex: string): string {
    if (!hex || !hex.trim()) {
      throw new Error('Hexadecimal input cannot be empty.');
    }
    const trimmed = hex.trim();
    const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length === 0) {
      throw new Error('Hexadecimal input must contain at least one hex value.');
    }
    
    if (!parts.every(h => /^[0-9a-fA-F]+$/.test(h))) {
      throw new Error('Hexadecimal must contain only 0-9 and A-F (case-insensitive), separated by spaces (e.g., "48 65 6C 6C 6F").');
    }
    
    try {
      return parts.map(h => {
        const charCode = parseInt(h, 16);
        if (isNaN(charCode) || charCode < 0 || charCode > 65535) {
          throw new Error(`Invalid hex value: ${h}`);
        }
        return String.fromCharCode(charCode);
      }).join('');
    } catch (e: any) {
      throw new Error(e.message || 'Invalid hexadecimal format. Each hex value should represent a valid character code.');
    }
  }
}

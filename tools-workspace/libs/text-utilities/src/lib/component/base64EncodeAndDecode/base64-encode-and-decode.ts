import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-base64-encode-and-decode',
  standalone: true,
  templateUrl: './base64-encode-and-decode.html',
  styleUrls: ['./base64-encode-and-decode.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class Base64EncodeAndDecodeComponent {
  readonly assetService = inject(AssetService);

  inputText = '';
  outputText = '';
  mode: 'encode' | 'decode' = 'encode';

  private fileInput: HTMLInputElement | null = null;

  get modeLabel(): string {
    return this.mode === 'encode' ? 'Encode' : 'Decode';
  }

  get hasInput(): boolean {
    return !!this.inputText;
  }

  get hasOutput(): boolean {
    return !!this.outputText;
  }

  get sizeDelta(): number {
    if (!this.outputText || !this.inputText) return 0;
    return this.outputText.length - this.inputText.length;
  }

  selectMode(selectedMode: 'encode' | 'decode'): void {
    if (this.mode !== selectedMode) {
      this.mode = selectedMode;
      this.inputText = '';
      this.outputText = '';
    }
  }

  onInputChange(): void {
    if (this.mode === 'encode') {
      this.encodeText();
    } else {
      this.decodeText();
    }
  }

  private encodeText(): void {
    if (!this.inputText) {
      this.outputText = '';
      return;
    }
    try {
      this.outputText = btoa(this.inputText);
    } catch {
      this.outputText = 'Invalid input for encoding';
    }
  }

  private decodeText(): void {
    if (!this.inputText) {
      this.outputText = '';
      return;
    }
    try {
      this.outputText = atob(this.inputText);
    } catch {
      this.outputText = 'Invalid Base64 string';
    }
  }

  clearInput(): void {
    this.inputText = '';
    this.outputText = '';
  }

  copyInput(): void {
    this.copyText(this.inputText, 'Input');
  }

  copyOutput(): void {
    this.copyText(this.outputText, 'Output');
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }

  uploadFile(): void {
    if (!this.fileInput) {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.style.display = 'none';

      this.fileInput.onchange = () => {
        const file = this.fileInput?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            this.inputText = (e.target?.result as string) ?? '';
            this.onInputChange();
          };
          reader.readAsText(file);
        }
      };
    }

    this.fileInput.accept = this.mode === 'encode' ? '.txt,text/*' : '';
    this.fileInput.click();
  }
}

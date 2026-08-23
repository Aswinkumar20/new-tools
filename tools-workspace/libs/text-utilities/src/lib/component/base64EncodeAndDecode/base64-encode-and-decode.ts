import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-base64-encode-and-decode',
  standalone: true,
  templateUrl: './base64-encode-and-decode.html',
styleUrls: ['./base64-encode-and-decode.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule],
})
export class Base64EncodeAndDecodeComponent {
  inputText: string = '';
  outputText: string = '';
  mode: 'encode' | 'decode' = 'encode';
  
  // File input element reference
  private fileInput: HTMLInputElement | null = null;

  selectMode(selectedMode: 'encode' | 'decode') {
    if (this.mode !== selectedMode) {
      this.mode = selectedMode;
      this.inputText = '';
      this.outputText = '';
    }
  }

  onInputChange() {
    if (this.mode === 'encode') {
      this.encodeText();
    } else {
      this.decodeText();
    }
  }

  private encodeText() {
    try {
      this.outputText = btoa(this.inputText);
    } catch {
      this.outputText = 'Invalid input for encoding';
    }
  }

  private decodeText() {
    try {
      this.outputText = atob(this.inputText);
    } catch {
      this.outputText = 'Invalid Base64 string';
    }
  }

  clearInput() {
    this.inputText = '';
    this.outputText = '';
  }

  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.outputText);
      // You might want to add a toast/notification here
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }

  uploadFile() {
    // Create file input if it doesn't exist
    if (!this.fileInput) {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.accept = this.mode === 'encode' ? '.txt,text/*' : '';
      this.fileInput.style.display = 'none';
      
      this.fileInput.onchange = () => {
        const file = this.fileInput?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            this.inputText = content;
            this.onInputChange();
          };
          
          if (this.mode === 'encode') {
            reader.readAsText(file);
          } else {
            reader.readAsText(file);
          }
        }
      };
    }
    
    // Update accept attribute based on current mode
    this.fileInput.accept = this.mode === 'encode' ? '.txt,text/*' : '';
    
    // Trigger file selection
    this.fileInput.click();
  }
}

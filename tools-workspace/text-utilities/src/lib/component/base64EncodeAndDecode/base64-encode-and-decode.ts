import { Component } from '@angular/core';

@Component({
  selector: 'lib-base64-encode-and-decode',
  standalone: false,
  templateUrl: './base64-encode-and-decode.html',
  styleUrls: ['./base64-encode-and-decode.scss'],
})
export class Base64EncodeAndDecode {
  inputText: string = '';
  outputText: string = '';
  mode: 'encode' | 'decode' = 'encode';

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
}

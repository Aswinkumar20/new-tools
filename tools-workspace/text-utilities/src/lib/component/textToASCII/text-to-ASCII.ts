import { Component } from '@angular/core';

@Component({
  selector: 'lib-text-to-ascii',
  standalone: false,
  templateUrl: './text-to-ASCII.html',
  styleUrls: ['./text-to-ASCII.scss'],
})

export class TextToASCII {
  mode: 'text-to-ascii' | 'ascii-to-text' = 'text-to-ascii';
  input: string = '';
  output: string = '';

  updateConversion() {
    if (this.mode === 'text-to-ascii') {
      this.output = this.input
        .split('')
        .map(char => char.charCodeAt(0))
        .join(' ');
    } else {
      this.output = this.input
        .trim()
        .split(/\s+/)
        .map(code => String.fromCharCode(Number(code)))
        .join('');
    }
  }

  toggleMode() {
    this.input = '';
    this.output = '';
    this.mode = this.mode === 'text-to-ascii' ? 'ascii-to-text' : 'text-to-ascii';
  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.output).then(() => {
      alert('Output copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy!');
    });
  }
}

import { ChangeDetectionStrategy, Component, WritableSignal, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation } from '@tools-workspace/features-home';

interface HistoryEntry {
  timestamp: number;
  input: string;
  output: string;
  mode: 'encode' | 'decode';
}

type EncodingMode = 'named' | 'numeric' | 'hex' | 'all';

const SAMPLE_TEXT = `Hello <world> & "friends"!
This is a sample text with special characters: ©, ®, ™, €, £, ¥`;

@Component({
  selector: 'lib-html-entity-encoder',
  standalone: true,
  templateUrl: './html-entity-encoder.html',
  styleUrls: ['./html-entity-encoder.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HtmlEntityEncoderComponent {
  readonly mode = signal<'encode' | 'decode'>('encode');
  readonly encodingMode = signal<EncodingMode>('named');
  readonly inputText = signal<string>(SAMPLE_TEXT);
  readonly outputText = signal<string>('');
  readonly errors = signal<string[]>([]);
  readonly history = signal<HistoryEntry[]>([]);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasOutput = computed(() => this.outputText().length > 0);

  constructor() {
    // Initial encoding
    this.process();
  }

  selectMode(selectedMode: 'encode' | 'decode'): void {
    if (this.mode() !== selectedMode) {
      this.mode.set(selectedMode);
      // Swap input and output
      const currentInput = this.inputText();
      const currentOutput = this.outputText();
      this.inputText.set(currentOutput);
      this.outputText.set(currentInput);
      this.process();
    }
  }

  selectEncodingMode(selectedMode: EncodingMode): void {
    this.encodingMode.set(selectedMode);
    this.process();
  }

  onInputChange(value: string): void {
    this.inputText.set(value);
    this.process();
  }

  process(): void {
    this.errors.set([]);
    const input = this.inputText().trim();

    if (!input) {
      this.outputText.set('');
      return;
    }

    try {
      if (this.mode() === 'encode') {
        this.outputText.set(this.encodeHtmlEntities(input, this.encodingMode()));
      } else {
        this.outputText.set(this.decodeHtmlEntities(input));
      }
      this.addToHistory();
    } catch (error) {
      this.errors.set([`Processing failed: ${(error as Error)?.message ?? 'Unknown error'}`]);
      this.outputText.set('');
    }
  }

  private encodeHtmlEntities(text: string, mode: EncodingMode): string {
    const namedEntities: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '©': '&copy;',
      '®': '&reg;',
      '™': '&trade;',
      '€': '&euro;',
      '£': '&pound;',
      '¥': '&yen;',
      '¢': '&cent;',
      '§': '&sect;',
      '°': '&deg;',
      '±': '&plusmn;',
      '×': '&times;',
      '÷': '&divide;',
      '½': '&frac12;',
      '¼': '&frac14;',
      '¾': '&frac34;',
      'á': '&aacute;',
      'é': '&eacute;',
      'í': '&iacute;',
      'ó': '&oacute;',
      'ú': '&uacute;',
      'ñ': '&ntilde;',
      'Á': '&Aacute;',
      'É': '&Eacute;',
      'Í': '&Iacute;',
      'Ó': '&Oacute;',
      'Ú': '&Uacute;',
      'Ñ': '&Ntilde;'
    };

    let result = text;

    if (mode === 'named' || mode === 'all') {
      // Encode using named entities
      for (const [char, entity] of Object.entries(namedEntities)) {
        result = result.replace(new RegExp(this.escapeRegex(char), 'g'), entity);
      }
    }

    if (mode === 'numeric' || mode === 'all') {
      // Encode remaining special characters as numeric entities
      result = result.replace(/[^\x00-\x7F]/g, (char) => {
        const code = char.charCodeAt(0);
        return `&#${code};`;
      });
    }

    if (mode === 'hex' || mode === 'all') {
      // Encode remaining special characters as hex entities
      result = result.replace(/[^\x00-\x7F]/g, (char) => {
        const code = char.charCodeAt(0);
        return `&#x${code.toString(16)};`;
      });
    }

    // Always encode basic HTML entities
    if (mode !== 'all') {
      result = result
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    return result;
  }

  private decodeHtmlEntities(text: string): string {
    // Create a temporary div element to decode HTML entities
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    let decoded = textarea.value;

    // If the textarea method didn't work (for some entities), use manual decoding
    if (decoded === text) {
      // Manual decoding for common entities
      const entityMap: { [key: string]: string } = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&nbsp;': ' ',
        '&copy;': '©',
        '&reg;': '®',
        '&trade;': '™',
        '&euro;': '€',
        '&pound;': '£',
        '&yen;': '¥',
        '&cent;': '¢',
        '&sect;': '§',
        '&deg;': '°',
        '&plusmn;': '±',
        '&times;': '×',
        '&divide;': '÷',
        '&frac12;': '½',
        '&frac14;': '¼',
        '&frac34;': '¾'
      };

      for (const [entity, char] of Object.entries(entityMap)) {
        decoded = decoded.replace(new RegExp(entity, 'gi'), char);
      }

      // Decode numeric entities (&#123;)
      decoded = decoded.replace(/&#(\d+);/g, (match, code) => {
        return String.fromCharCode(Number.parseInt(code, 10));
      });

      // Decode hex entities (&#x1F;)
      decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/g, (match, code) => {
        return String.fromCharCode(Number.parseInt(code, 16));
      });
    }

    return decoded;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  copyToClipboard(text: string, label: string): void {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Success - could show toast
      })
      .catch(() => {
        this.errors.set([`Unable to copy ${label} to clipboard.`]);
      });
  }

  loadSample(): void {
    this.inputText.set(SAMPLE_TEXT);
    this.process();
  }

  clear(): void {
    this.inputText.set('');
    this.outputText.set('');
    this.errors.set([]);
  }

  swapInputOutput(): void {
    const currentInput = this.inputText();
    const currentOutput = this.outputText();
    this.inputText.set(currentOutput);
    this.outputText.set(currentInput);
    this.process();
  }

  applyHistory(entry: HistoryEntry): void {
    this.mode.set(entry.mode);
    this.inputText.set(entry.input);
    this.outputText.set(entry.output);
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  private addToHistory(): void {
    const input = this.inputText().trim();
    const output = this.outputText().trim();

    if (!input || !output) {
      return;
    }

    const entry: HistoryEntry = {
      timestamp: Date.now(),
      input,
      output,
      mode: this.mode()
    };

    this.history.update((entries) => {
      const exists = entries.some(
        (e) => e.input === entry.input && e.output === entry.output && e.mode === entry.mode
      );
      if (exists) {
        return entries;
      }
      return [entry, ...entries].slice(0, 10);
    });
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (days < 7) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}

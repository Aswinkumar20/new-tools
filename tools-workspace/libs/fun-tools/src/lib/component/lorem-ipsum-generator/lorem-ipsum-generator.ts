import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

type GenerationType = 'paragraphs' | 'words' | 'sentences';
type StartWith = 'lorem' | 'random';

type LoremFormGroup = FormGroup<{
  type: FormControl<GenerationType>;
  count: FormControl<number>;
  startWith: FormControl<StartWith>;
}>;

const LOREM_WORDS = [
  'lorem',
  'ipsum',
  'dolor',
  'sit',
  'amet',
  'consectetur',
  'adipiscing',
  'elit',
  'sed',
  'do',
  'eiusmod',
  'tempor',
  'incididunt',
  'ut',
  'labore',
  'et',
  'dolore',
  'magna',
  'aliqua',
  'enim',
  'ad',
  'minim',
  'veniam',
  'quis',
  'nostrud',
  'exercitation',
  'ullamco',
  'laboris',
  'nisi',
  'ut',
  'aliquip',
  'ex',
  'ea',
  'commodo',
  'consequat',
  'duis',
  'aute',
  'irure',
  'dolor',
  'in',
  'reprehenderit',
  'voluptate',
  'velit',
  'esse',
  'cillum',
  'dolore',
  'eu',
  'fugiat',
  'nulla',
  'pariatur',
  'excepteur',
  'sint',
  'occaecat',
  'cupidatat',
  'non',
  'proident',
  'sunt',
  'in',
  'culpa',
  'qui',
  'officia',
  'deserunt',
  'mollit',
  'anim',
  'id',
  'est',
  'laborum'
];

@Component({
  selector: 'lib-lorem-ipsum-generator',
  standalone: true,
  templateUrl: './lorem-ipsum-generator.html',
  styleUrls: ['./lorem-ipsum-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoremIpsumGeneratorComponent {
  private readonly fb = inject(FormBuilder);

  readonly form: LoremFormGroup = this.fb.group({
    type: this.fb.control<GenerationType>('paragraphs', { nonNullable: true }),
    count: this.fb.control(3, { nonNullable: true }),
    startWith: this.fb.control<StartWith>('lorem', { nonNullable: true })
  });

  readonly generatedText = signal<string>('');
  readonly errors = signal<string[]>([]);

  readonly stats = computed(() => {
    const text = this.generatedText();
    if (!text) {
      return { words: 0, characters: 0, paragraphs: 0, sentences: 0 };
    }

    const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length;
    const characters = text.length;
    const paragraphs = text.split(/\n\n/).filter((p) => p.trim().length > 0).length;
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;

    return { words, characters, paragraphs, sentences };
  });

  readonly hasGeneratedText = computed(() => this.generatedText().length > 0);

  constructor() {
    // Generate initial text
    this.generate();
  }

  generate(): void {
    this.errors.set([]);
    const { type, count, startWith } = this.form.getRawValue();

    if (count < 1) {
      this.errors.set(['Count must be at least 1.']);
      return;
    }

    if (type === 'paragraphs' && count > 50) {
      this.errors.set(['Maximum 50 paragraphs allowed.']);
      return;
    }

    if (type === 'words' && count > 1000) {
      this.errors.set(['Maximum 1000 words allowed.']);
      return;
    }

    if (type === 'sentences' && count > 200) {
      this.errors.set(['Maximum 200 sentences allowed.']);
      return;
    }

    let text = '';

    switch (type) {
      case 'paragraphs':
        text = this.generateParagraphs(count, startWith);
        break;
      case 'words':
        text = this.generateWords(count, startWith);
        break;
      case 'sentences':
        text = this.generateSentences(count, startWith);
        break;
    }

    this.generatedText.set(text);
  }

  private generateParagraphs(count: number, startWith: StartWith): string {
    const paragraphs: string[] = [];
    for (let i = 0; i < count; i++) {
      const sentenceCount = 3 + Math.floor(Math.random() * 5); // 3-7 sentences per paragraph
      const paragraph = this.generateSentences(sentenceCount, i === 0 ? startWith : 'random');
      paragraphs.push(paragraph);
    }
    return paragraphs.join('\n\n');
  }

  private generateWords(count: number, startWith: StartWith): string {
    const words: string[] = [];
    const wordList = [...LOREM_WORDS];

    if (startWith === 'lorem' && count > 0) {
      words.push('Lorem');
      count--;
    }

    for (let i = 0; i < count; i++) {
      const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
      words.push(i === 0 && startWith === 'lorem' ? randomWord : randomWord);
    }

    return words.join(' ');
  }

  private generateSentences(count: number, startWith: StartWith): string {
    const sentences: string[] = [];
    const wordList = [...LOREM_WORDS];

    for (let i = 0; i < count; i++) {
      const wordCount = 8 + Math.floor(Math.random() * 12); // 8-19 words per sentence
      const words: string[] = [];

      if (i === 0 && startWith === 'lorem') {
        words.push('Lorem');
        words.push('ipsum');
        for (let j = 0; j < wordCount - 2; j++) {
          words.push(wordList[Math.floor(Math.random() * wordList.length)]);
        }
      } else {
        for (let j = 0; j < wordCount; j++) {
          const word = wordList[Math.floor(Math.random() * wordList.length)];
          if (j === 0) {
            words.push(word.charAt(0).toUpperCase() + word.slice(1));
          } else {
            words.push(word);
          }
        }
      }

      const sentence = words.join(' ') + '.';
      sentences.push(sentence);
    }

    return sentences.join(' ');
  }

  copyToClipboard(): void {
    const text = this.generatedText();
    if (!text) {
      return;
    }

    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Success - could show a toast notification
      })
      .catch(() => {
        this.errors.set(['Failed to copy text to clipboard.']);
      });
  }

  clearText(): void {
    this.generatedText.set('');
    this.errors.set([]);
  }
}

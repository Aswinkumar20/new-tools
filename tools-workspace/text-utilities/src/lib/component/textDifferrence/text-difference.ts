import { Component } from '@angular/core';

@Component({
  selector: 'lib-text-difference',
  standalone: false,
  templateUrl: './text-difference.html',
  styleUrls: ['./text-difference.scss'],
})
export class TextDifference {
  text1: string = '';
  text2: string = '';
  diffLinesA: DiffLine[] = [];
  diffLinesB: DiffLine[] = [];

  onTextChange() {
    const a = this.text1.split('\n');
    const b = this.text2.split('\n');
    const max = Math.max(a.length, b.length);

    this.diffLinesA = [];
    this.diffLinesB = [];

    for (let i = 0; i < max; i++) {
      const lineA = a[i] ?? '';
      const lineB = b[i] ?? '';

      if (lineA === lineB) {
        this.diffLinesA.push({ text: lineA, type: 'unchanged' });
        this.diffLinesB.push({ text: lineB, type: 'unchanged' });
      } else {
        this.diffLinesA.push({ text: lineA, type: lineA ? 'removed' : 'empty' });
        this.diffLinesB.push({ text: lineB, type: lineB ? 'added' : 'empty' });
      }
    }
  }

  get hasAnyDifference(): boolean {
    return this.diffLinesA.some(line => line.type === 'removed') || this.diffLinesB.some(line => line.type === 'added');
  }

}

interface DiffLine {
  text: string;
  type: 'unchanged' | 'added' | 'removed' | 'empty';
}


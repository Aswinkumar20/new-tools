import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-code-merge',
  standalone: true,
  templateUrl: './code-merge.html',
  styleUrls: ['./code-merge.scss'],
    imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule],

})
export class CodeMergeComponent {
  leftBranch = '';
  rightBranch = '';
  baseLabel = 'HEAD';
  incomingLabel = 'Incoming';
  includeConflictMarkers = true;
  mergedPreview = '';
  copied = false;

  merge() {
    const left = this.leftBranch ?? '';
    const right = this.rightBranch ?? '';
    if (!left && !right) {
      this.mergedPreview = '';
      return;
    }

    if (this.includeConflictMarkers) {
      this.mergedPreview = [
        `<<<<<<< ${this.baseLabel || 'HEAD'}`,
        left,
        '=======',
        right,
        `>>>>>>> ${this.incomingLabel || 'Incoming'}`
      ].join('\n');
    } else {
      this.mergedPreview = `${left}\n${right}`.trim();
    }
    this.copied = false;
  }

  clear() {
    this.leftBranch = '';
    this.rightBranch = '';
    this.mergedPreview = '';
    this.copied = false;
  }

  copyMerged() {
    if (!this.mergedPreview) {
      return;
    }
    navigator.clipboard.writeText(this.mergedPreview).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }
}

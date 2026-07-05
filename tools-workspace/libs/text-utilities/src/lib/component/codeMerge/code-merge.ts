import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-code-merge',
  standalone: true,
  templateUrl: './code-merge.html',
  styleUrls: ['./code-merge.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class CodeMergeComponent {
  readonly assetService = inject(AssetService);

  leftBranch = '';
  rightBranch = '';
  baseLabel = 'HEAD';
  incomingLabel = 'Incoming';
  includeConflictMarkers = true;
  mergedPreview = '';

  get hasLeft(): boolean {
    return !!this.leftBranch;
  }

  get hasRight(): boolean {
    return !!this.rightBranch;
  }

  get leftLineCount(): number {
    return this.leftBranch ? this.leftBranch.split('\n').length : 0;
  }

  get rightLineCount(): number {
    return this.rightBranch ? this.rightBranch.split('\n').length : 0;
  }

  merge(): void {
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
        `>>>>>>> ${this.incomingLabel || 'Incoming'}`,
      ].join('\n');
    } else {
      this.mergedPreview = `${left}\n${right}`.trim();
    }
  }

  clear(): void {
    this.leftBranch = '';
    this.rightBranch = '';
    this.mergedPreview = '';
  }

  copyLeft(): void {
    this.copyText(this.leftBranch, 'Left branch');
  }

  copyRight(): void {
    this.copyText(this.rightBranch, 'Right branch');
  }

  copyMerged(): void {
    this.copyText(this.mergedPreview, 'Merged preview');
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }
}

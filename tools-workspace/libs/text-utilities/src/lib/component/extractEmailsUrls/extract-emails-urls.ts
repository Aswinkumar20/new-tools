import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { extractEmails, extractUrls } from '../../shared/text-transform.utils';

export type ExtractType = 'emails' | 'urls' | 'both';

@Component({
  selector: 'lib-extract-emails-urls',
  standalone: true,
  templateUrl: './extract-emails-urls.html',
  styleUrls: ['./extract-emails-urls.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class ExtractEmailsUrlsComponent extends TextToolBase {
  extractType: ExtractType = 'both';
  extractedCount = 0;

  readonly extractOptions: { value: ExtractType; label: string }[] = [
    { value: 'emails', label: 'Emails' },
    { value: 'urls', label: 'URLs' },
    { value: 'both', label: 'Both' },
  ];

  setExtractType(type: ExtractType): void {
    if (this.extractType === type) return;
    this.extractType = type;
    this.onOptionsChange();
  }

  protected process(): void {
    const emails = this.extractType !== 'urls' ? extractEmails(this.inputText) : [];
    const urls = this.extractType !== 'emails' ? extractUrls(this.inputText) : [];
    const items = [...emails, ...urls];
    this.extractedCount = items.length;
    this.outputText = items.join('\n');
  }
}

#!/usr/bin/env node
/**
 * Generates text utility tool components from manifest.
 * Run: node libs/text-utilities/scripts/generate-text-tools.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const COMP = path.join(ROOT, 'src/lib/component');

const SCSS = `@use '../../shared/text-tool-layout.scss';
`;

const SPEC = (className, selector) => `import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ${className} } from './${selector}';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('${className}', () => {
  let component: ${className};
  let fixture: ComponentFixture<${className}>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [${className}],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(${className});
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
`;

function writeTool(folder, selector, files) {
  const dir = path.join(COMP, folder);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
}

// ─── Standard encode/decode HTML template ───────────────────────────────────
function encodeDecodeHtml(title, subtitle, inputEnc, inputDec, outputEnc, outputDec, tips, optionsHtml = '') {
  return `<div class="ttool">
  <lib-navigation></lib-navigation>
  <main class="ttool__main">
    <div class="ttool__top">
      <header class="ttool__header">
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </header>
      <div class="ttool__stats" aria-label="Statistics">
        <div class="ttool__stat ttool__stat--mode">
          <span class="ttool__stat-value" [title]="modeLabel">{{ modeLabel }}</span>
          <span class="ttool__stat-label">Mode</span>
        </div>
        <div class="ttool__stat">
          <span class="ttool__stat-value">{{ inputText.length }}</span>
          <span class="ttool__stat-label">Input</span>
        </div>
        <div class="ttool__stat">
          <span class="ttool__stat-value">{{ outputText.length }}</span>
          <span class="ttool__stat-label">Output</span>
        </div>
      </div>
    </div>
    <div class="ttool__workflow">
      <div class="ttool__mode-group" role="group" aria-label="Mode">
        <button type="button" class="ttool__chip-btn" [class.ttool__chip-btn--active]="mode === 'encode'" (click)="selectMode('encode')">Encode</button>
        <button type="button" class="ttool__chip-btn" [class.ttool__chip-btn--active]="mode === 'decode'" (click)="selectMode('decode')">Decode</button>
      </div>
      ${optionsHtml}
    </div>
    ${editorBlock(inputEnc, inputDec, outputEnc, outputDec)}
    <aside class="ttool__sidebar"><div class="ttool__panel"><ul class="ttool__tips">${tips.map(t => `<li>${t}</li>`).join('')}</ul></div></aside>
    <details class="ttool__help"><summary>How to use</summary><ul><li>Choose Encode or Decode, paste text, and copy the result.</li></ul></details>
  </main>
</div>`;
}

function transformHtml(title, subtitle, workflowHtml, tips) {
  return `<div class="ttool">
  <lib-navigation></lib-navigation>
  <main class="ttool__main">
    <div class="ttool__top">
      <header class="ttool__header"><h1>${title}</h1><p>${subtitle}</p></header>
      <div class="ttool__stats">
        <div class="ttool__stat"><span class="ttool__stat-value">{{ inputText.length }}</span><span class="ttool__stat-label">Input</span></div>
        <div class="ttool__stat"><span class="ttool__stat-value">{{ outputText.length }}</span><span class="ttool__stat-label">Output</span></div>
      </div>
    </div>
    <div class="ttool__workflow">${workflowHtml}</div>
    ${singleEditorBlock()}
    <aside class="ttool__sidebar"><div class="ttool__panel"><ul class="ttool__tips">${tips.map(t => `<li>${t}</li>`).join('')}</ul></div></aside>
  </main>
</div>`;
}

function editorBlock(inputEnc, inputDec, outputEnc, outputDec) {
  return `<div class="ttool__workspace">
    <div class="ttool__editors">
      <section class="ttool__editor" [class.ttool__editor--dragover]="isDragOver" (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
        <header class="ttool__editor-head">
          <span class="ttool__editor-title">{{ mode === 'encode' ? '${inputEnc}' : '${inputDec}' }}</span>
          <div class="ttool__toolbar">${toolbarInput()}</div>
        </header>
        <textarea #inputTextarea class="ttool__textarea ttool__textarea--mono" [(ngModel)]="inputText" (input)="onInputChange()" rows="1" [placeholder]="mode === 'encode' ? 'Paste text to encode…' : 'Paste text to decode…'"></textarea>
      </section>
      <section class="ttool__editor ttool__editor--output" [class.ttool__editor--error]="errorMessage">
        <header class="ttool__editor-head">
          <div class="ttool__editor-head-left">
            <span class="ttool__editor-title">{{ mode === 'encode' ? '${outputEnc}' : '${outputDec}' }}</span>
            @if (hasOutput) { <span class="ttool__editor-badge">Ready</span> }
            @else if (errorMessage) { <span class="ttool__editor-badge ttool__editor-badge--error">Error</span> }
          </div>
          <div class="ttool__toolbar">${toolbarOutput()}</div>
        </header>
        @if (errorMessage) { <div class="ttool__error" role="alert"><p>{{ errorMessage }}</p></div> }
        @else if (hasOutput) { <textarea class="ttool__textarea ttool__textarea--output ttool__textarea--mono" readonly rows="1" [value]="outputText"></textarea> }
        @else { <div class="ttool__empty"><p>Output appears here as you type.</p></div> }
      </section>
    </div>`;
}

function singleEditorBlock() {
  return `<div class="ttool__workspace">
    <div class="ttool__editors">
      <section class="ttool__editor" [class.ttool__editor--dragover]="isDragOver" (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
        <header class="ttool__editor-head">
          <span class="ttool__editor-title">Input</span>
          <div class="ttool__toolbar">${toolbarInput()}</div>
        </header>
        <textarea #inputTextarea class="ttool__textarea" [(ngModel)]="inputText" (input)="onInputChange()" rows="1" placeholder="Paste or type your text…"></textarea>
      </section>
      <section class="ttool__editor ttool__editor--output" [class.ttool__editor--error]="errorMessage">
        <header class="ttool__editor-head">
          <div class="ttool__editor-head-left">
            <span class="ttool__editor-title">Output</span>
            @if (hasOutput) { <span class="ttool__editor-badge">Ready</span> }
            @else if (errorMessage) { <span class="ttool__editor-badge ttool__editor-badge--error">Error</span> }
          </div>
          <div class="ttool__toolbar">${toolbarOutput()}</div>
        </header>
        @if (errorMessage) { <div class="ttool__error" role="alert"><p>{{ errorMessage }}</p></div> }
        @else if (hasOutput) { <textarea class="ttool__textarea ttool__textarea--output" readonly rows="1" [value]="outputText"></textarea> }
        @else { <div class="ttool__empty"><p>Output appears here as you type.</p></div> }
      </section>
    </div>`;
}

function toolbarInput() {
  return `<button type="button" class="ttool__tool-btn" (click)="uploadTextFile()" [disabled]="isReadingFile" appTooltip="Upload file" tooltipPosition="bottom"><img [src]="assetService.getAssetPath(isReadingFile ? 'icons/spinner.svg' : 'icons/upload.svg')" alt="" width="18" height="18" /><span class="ttool__tool-btn-label">Upload</span></button>
          <button type="button" class="ttool__tool-btn" (click)="copyInput()" [disabled]="!hasInput" appTooltip="Copy input" tooltipPosition="bottom"><img [src]="assetService.getAssetPath('icons/copy.svg')" alt="" width="18" height="18" /><span class="ttool__tool-btn-label">Copy</span></button>
          <button type="button" class="ttool__tool-btn" (click)="undo()" [disabled]="!canUndo" appTooltip="Undo" tooltipPosition="bottom"><img [src]="assetService.getAssetPath('icons/undo.svg')" alt="" width="18" height="18" /><span class="ttool__tool-btn-label">Undo</span></button>
          <button type="button" class="ttool__tool-btn" (click)="redo()" [disabled]="!canRedo" appTooltip="Redo" tooltipPosition="bottom"><img [src]="assetService.getAssetPath('icons/redo.svg')" alt="" width="18" height="18" /><span class="ttool__tool-btn-label">Redo</span></button>
          <button type="button" class="ttool__tool-btn" (click)="clear()" appTooltip="Clear" tooltipPosition="bottom"><img [src]="assetService.getAssetPath('icons/clear.svg')" alt="" width="18" height="18" /><span class="ttool__tool-btn-label">Clear</span></button>`;
}

function toolbarOutput() {
  return `<button type="button" class="ttool__tool-btn" (click)="copyOutput()" [disabled]="!hasOutput" appTooltip="Copy output" tooltipPosition="bottom"><img [src]="assetService.getAssetPath('icons/copy.svg')" alt="" width="18" height="18" /><span class="ttool__tool-btn-label">Copy</span></button>
          <button type="button" class="ttool__tool-btn" (click)="downloadText()" [disabled]="!hasOutput" appTooltip="Download" tooltipPosition="bottom"><img [src]="assetService.getAssetPath('icons/txt.svg')" alt="" width="18" height="18" /><span class="ttool__tool-btn-label">TXT</span></button>
          <button type="button" class="ttool__tool-btn" (click)="useOutputAsInput()" [disabled]="!hasOutput" appTooltip="Use as input" tooltipPosition="bottom"><span class="ttool__tool-btn-label">→ In</span></button>`;
}

const IMPORTS = `import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';`;

const COMPONENT_DECOR = (selector, file) => `@Component({
  selector: '${selector}',
  standalone: true,
  templateUrl: './${file}.html',
  styleUrls: ['./${file}.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})`;

// Generate each tool manually in this script via writeTool calls below
console.log('Use inline writeTool calls');

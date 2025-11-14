import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation } from '@tools-workspace/features-home';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';


@Component({
  selector: 'lib-text-difference',
  standalone: true,
  templateUrl: './text-difference.html',
  styleUrls: ['./text-difference.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, MonacoEditorModule],
})
export class TextDifferenceComponent {
  themes = ['vs-dark', 'vs-light'];
  languages = ['typescript', 'javascript', 'json', 'html', 'css', 'text/plain'];


  editorOptions = {
    theme: this.themes[0],
    language: this.languages[0],
    readOnly: false,
    originalEditable: true,
    fontSize: 16,
  };

  originalModel = {
    code: 'heLLo world!',
    language: this.languages[0],
  };

  modifiedModel = {
    code: 'hello world!',
    language: this.languages[0],
  };

  private editor: any;

  onEditorInit(editor: any) {
    this.editor = editor;
  }

  onThemeChange(theme: string) {
    this.editorOptions = { ...this.editorOptions, theme };
  }

  onLanguageChange(language: string) {
    this.editorOptions = { ...this.editorOptions, language };
    this.originalModel = { ...this.originalModel, language };
    this.modifiedModel = { ...this.modifiedModel, language };
  }
}
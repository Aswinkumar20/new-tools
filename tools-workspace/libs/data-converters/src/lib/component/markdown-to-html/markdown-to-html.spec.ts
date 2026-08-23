import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { converterTestProviders } from '../../shared/converter-test.utils';
import { MarkdownToHtmlComponent } from './markdown-to-html';

describe('MarkdownToHtmlComponent', () => {
  let component: MarkdownToHtmlComponent;
  let fixture: ComponentFixture<MarkdownToHtmlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownToHtmlComponent],
      providers: [...converterTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownToHtmlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load sample Markdown on init', () => {
    expect(component).toBeTruthy();
    expect(component.conversionMode).toBe('markdown-to-html');
    expect(component.markdownInput).toContain('Welcome to the toolkit');
    expect(component.htmlInput).toContain('Release Notes');
    expect(component.metrics.lines).toBeGreaterThan(0);
  });

  it('converts Markdown to HTML', () => {
    component.convert();
    expect(component.conversionStatus.status).toBe('success');
    expect(component.resultOutput).toContain('<h1>');
    expect(component.operationHistory[0].label).toBe('Converted Markdown to HTML');
  });

  it('converts HTML to Markdown', () => {
    component.onSelectionModeChange('html-to-markdown');
    component.convert();
    expect(component.conversionStatus.status).toBe('success');
    expect(component.resultOutput).toContain('Release Notes');
    expect(component.resultOutput).toContain('**Markdown**');
    expect(component.operationHistory[0].label).toBe('Converted HTML to Markdown');
  });

  it('surfaces an error for empty Markdown conversion', () => {
    component.markdownInput = '';
    component.convert();
    expect(component.conversionStatus.status).toBe('error');
    expect(component.conversionStatus.message).toContain('empty');
  });

  it('caps operation history at six entries', () => {
    for (let i = 0; i < 8; i++) {
      component.convert();
    }
    expect(component.operationHistory.length).toBe(6);
  });

  it('applies mode-switch suggestions while preserving input', () => {
    component.markdownInput = '<article><p>Hello</p></article>';
    component.onMarkdownInputChange(component.markdownInput);
    expect(component.primarySuggestion?.id).toBe('mth-switch-html');
    const suggestion = component.primarySuggestion!;
    component.applySuggestion(suggestion);
    expect(component.conversionMode).toBe('html-to-markdown');
    expect(component.htmlInput).toContain('<article>');
  });

  it('provides a dismissible empty-state suggestion', () => {
    component.onMarkdownInputChange('');
    expect(component.primarySuggestion?.id).toBe('mth-empty');
    const suggestion = component.primarySuggestion;
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });
});

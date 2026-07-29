import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { cftToolTestProviders } from '../../shared/cft-tool-test.utils';
import { MarkdownToPdfComponent } from './markdown-to-pdf';

describe('MarkdownToPdfComponent', () => {
  let component: MarkdownToPdfComponent;
  let fixture: ComponentFixture<MarkdownToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownToPdfComponent],
      providers: [...cftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownToPdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and convert the sample on init', () => {
    expect(component).toBeTruthy();
    expect(component.hasContent()).toBe(true);
    expect(component.hasHtmlOutput()).toBe(true);
    expect(component.htmlOutput()).toContain('<h1>');
  });

  it('clears and reloads sample Markdown', () => {
    component.clear();
    expect(component.hasHtmlOutput()).toBe(false);
    expect(component.hasContent()).toBe(false);

    component.loadSample();
    expect(component.hasContent()).toBe(true);
    expect(component.hasHtmlOutput()).toBe(true);
  });

  it('updates PDF options', () => {
    component.updateOption('pageSize', 'letter');
    component.updateOption('orientation', 'landscape');
    component.updateOption('margin', 30);
    expect(component.pdfOptions().pageSize).toBe('letter');
    expect(component.pdfOptions().orientation).toBe('landscape');
    expect(component.pdfOptions().margin).toBe(30);
  });

  it('surfaces an error when generating PDF without HTML', async () => {
    component.clear();
    await component.generatePdf();
    expect(component.errors()[0]).toContain('No HTML content');
    expect(component.isGenerating()).toBe(false);
  });

  it('provides a dismissible suggestion', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });
});

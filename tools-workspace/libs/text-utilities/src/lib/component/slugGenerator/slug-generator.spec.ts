import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { SlugGeneratorComponent } from './slug-generator';

describe('SlugGeneratorComponent', () => {
  let component: SlugGeneratorComponent;
  let fixture: ComponentFixture<SlugGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SlugGeneratorComponent],
      providers: [...textToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SlugGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with get-started suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('slug-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('generates a slug from headline', () => {
    component.inputText = 'Hello World Example';
    component.onInputChange();
    expect(component.slug).toBe('hello-world-example');
    expect(component.primarySuggestion?.id).toBe('slug-ready');
  });

  it('uses underscore separator', () => {
    component.setSeparator('_');
    component.inputText = 'Hello World';
    component.onInputChange();
    expect(component.slug).toBe('hello_world');
  });

  it('removes numbers when enabled', () => {
    component.removeNumbers = true;
    component.inputText = 'Top 10 Tips';
    component.onOptionsChange();
    expect(component.slug).not.toContain('10');
  });

  it('swaps input and slug', () => {
    component.inputText = 'My Title';
    component.onInputChange();
    const slug = component.slug;
    component.swapInputOutput();
    expect(component.inputText).toBe(slug);
    expect(component.slug).toBe('My Title');
  });

  it('clears input and slug', () => {
    component.inputText = 'Test';
    component.onInputChange();
    component.clear();
    expect(component.inputText).toBe('');
    expect(component.slug).toBe('');
  });

  it('suggests when input looks like a URL', () => {
    component.inputText = 'https://example.com/My Page';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('slug-looks-url');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });
});

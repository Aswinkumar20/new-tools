import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TrimNormalizeWhitespaceComponent } from './trim-normalize-whitespace';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';

describe('TrimNormalizeWhitespaceComponent', () => {
  let component: TrimNormalizeWhitespaceComponent;
  let fixture: ComponentFixture<TrimNormalizeWhitespaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrimNormalizeWhitespaceComponent],
      providers: [...textToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TrimNormalizeWhitespaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with get-started suggestion and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('tnw-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.activeOptionCount).toBe(1);
  });

  it('trims line edges', () => {
    component.inputText = '  hello  \n  world  ';
    component.onInputChange();
    expect(component.outputText).toBe('hello\nworld');
    expect(component.primarySuggestion?.id).toBe('tnw-cleaned');
  });

  it('suggests CRLF normalize when endings are mixed', () => {
    component.inputText = 'hello\r\nworld';
    component.normalizeLineEndings = false;
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('tnw-crlf');
  });

  it('suggests no-options when all toggles are off', () => {
    component.trimLines = false;
    component.collapseSpaces = false;
    component.removeEmptyLines = false;
    component.normalizeLineEndings = false;
    component.inputText = '  spaced  ';
    component.onInputChange();
    expect(component.activeOptionCount).toBe(0);
    expect(component.primarySuggestion?.id).toBe('tnw-no-options');
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

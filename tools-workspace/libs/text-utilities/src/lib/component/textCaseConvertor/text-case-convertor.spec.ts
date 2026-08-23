import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { TextCaseConvertorComponent } from './text-case-convertor';

describe('TextCaseConvertorComponent', () => {
  let component: TextCaseConvertorComponent;
  let fixture: ComponentFixture<TextCaseConvertorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextCaseConvertorComponent],
      providers: [...textToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TextCaseConvertorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with get-started suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('tcc-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('converts input on change', () => {
    component.selectedCase = 'upper';
    component.onInputChange('hello');
    expect(component.convertedText).toBe('HELLO');
    expect(component.primarySuggestion?.id).toBe('tcc-converted');
  });

  it('converts line-by-line in batch mode', () => {
    component.selectedCase = 'upper';
    component.batchLineMode = true;
    component.onInputChange('hello\nworld');
    expect(component.convertedText).toBe('HELLO\nWORLD');
  });

  it('converts selection only in output without changing source', () => {
    component.selectedCase = 'upper';
    component.inputText = 'say hello world';
    component.selectionPreview = { start: 4, end: 9 };
    component['refreshOutput']();
    expect(component.convertedText).toBe('say HELLO world');
    expect(component.inputText).toBe('say hello world');
  });

  it('clears selection preview when source is edited', () => {
    component.selectionPreview = { start: 0, end: 3 };
    component.onInputChange('new text');
    expect(component.selectionPreview).toBeNull();
  });

  it('cycles programming cases', () => {
    component.selectedCase = 'camel';
    component.cycleProgrammingCase();
    expect(component.selectedCase).toBe('snake');
  });

  it('detects camelCase in source', () => {
    component.inputText = 'myVariableName';
    expect(component.detectedCaseLabel).toBe('camelCase');
  });

  it('suggests when camelCase input uses a different preset', () => {
    component.selectedCase = 'upper';
    component.onInputChange('myVariableName');
    expect(component.primarySuggestion?.id).toBe('tcc-detected-programming');
  });

  it('swaps output to source', () => {
    component.inputText = 'hello';
    component.selectedCase = 'upper';
    component['refreshOutput']();
    component.swapSourceOutput();
    expect(component.inputText).toBe('HELLO');
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

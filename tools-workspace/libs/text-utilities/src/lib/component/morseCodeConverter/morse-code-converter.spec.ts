import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { MorseCodeConverterComponent } from './morse-code-converter';

describe('MorseCodeConverterComponent', () => {
  let component: MorseCodeConverterComponent;
  let fixture: ComponentFixture<MorseCodeConverterComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MorseCodeConverterComponent],
      providers: [...textToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(MorseCodeConverterComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with get-started suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('morse-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('encodes text to morse', () => {
    component.selectMode('encode');
    component.inputText = 'SOS';
    component.onInputChange();
    expect(component.outputText).toContain('...');
    expect(component.hasOutput).toBe(true);
    expect(component.primarySuggestion?.id).toBe('morse-encoded');
  });

  it('decodes morse to text', () => {
    component.selectMode('decode');
    component.inputText = '... --- ...';
    component.onInputChange();
    expect(component.outputText).toBe('SOS');
    expect(component.primarySuggestion?.id).toBe('morse-decoded');
  });

  it('suggests decode when encode input looks like Morse', () => {
    component.selectMode('encode');
    component.inputText = '... --- ...';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('morse-looks-morse');
  });

  it('suggests encode when decode input looks like plain text', () => {
    component.selectMode('decode');
    component.inputText = 'hello';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('morse-not-morse');
  });

  it('swaps output into input when switching modes', () => {
    component.selectMode('encode');
    component.inputText = 'HI';
    component.onInputChange();
    const morse = component.outputText;
    component.selectMode('decode');
    expect(component.inputText).toBe(morse);
    expect(toast.info).toHaveBeenCalledWith('Switched to To text mode');
  });

  it('clears with toast feedback', () => {
    component.inputText = 'SOS';
    component.onInputChange();
    component.clear();
    expect(component.inputText).toBe('');
    expect(component.outputText).toBe('');
    expect(toast.info).toHaveBeenCalledWith('Text cleared');
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

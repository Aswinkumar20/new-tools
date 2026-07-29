import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { BinaryTextConverterComponent } from './binary-text-converter';

describe('BinaryTextConverterComponent', () => {
  let component: BinaryTextConverterComponent;
  let fixture: ComponentFixture<BinaryTextConverterComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BinaryTextConverterComponent],
      providers: [...textToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(BinaryTextConverterComponent);
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
    expect(component.primarySuggestion?.id).toBe('btc-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('encodes text to binary', () => {
    component.selectMode('encode');
    component.inputText = 'A';
    component.onInputChange();
    expect(component.outputText).toContain('01000001');
    expect(component.primarySuggestion?.id).toBe('btc-encoded');
  });

  it('decodes binary to text', () => {
    component.selectMode('decode');
    component.inputText = '01000001';
    component.onInputChange();
    expect(component.outputText).toBe('A');
    expect(component.primarySuggestion?.id).toBe('btc-decoded');
  });

  it('reports invalid binary length', () => {
    component.selectMode('decode');
    component.inputText = '0100000';
    component.onInputChange();
    expect(component.errorMessage).toContain('multiple of 8');
    expect(component.hasOutput).toBe(false);
    expect(component.primarySuggestion?.id).toBe('btc-length');
  });

  it('re-encodes when separator or bit width changes', () => {
    component.selectMode('encode');
    component.inputText = 'AB';
    component.onInputChange();
    component.setSeparator('colon');
    expect(component.outputText).toBe('01000001:01000010');
    component.setBits(16);
    expect(component.outputText.split(':')).toHaveLength(2);
    expect(component.outputText.split(':')[0]).toHaveLength(16);
  });

  it('suggests decode when encode input looks like binary', () => {
    component.selectMode('encode');
    component.inputText = '01000001 01000010';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('btc-looks-binary');
  });

  it('clears with toast feedback', () => {
    component.inputText = 'A';
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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { Base64EncodeAndDecodeComponent } from './base64-encode-and-decode';

describe('Base64EncodeAndDecodeComponent', () => {
  let component: Base64EncodeAndDecodeComponent;
  let fixture: ComponentFixture<Base64EncodeAndDecodeComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Base64EncodeAndDecodeComponent],
      providers: [...textToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(Base64EncodeAndDecodeComponent);
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
    expect(component.primarySuggestion?.id).toBe('b64-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('encodes text to base64', () => {
    component.selectMode('encode');
    component.inputText = 'hello';
    component.onInputChange();
    expect(component.outputText).toBe('aGVsbG8=');
    expect(component.errorMessage).toBe('');
    expect(component.primarySuggestion?.id).toBe('b64-encoded');
  });

  it('decodes base64 to text', () => {
    component.selectMode('decode');
    component.inputText = 'aGVsbG8=';
    component.onInputChange();
    expect(component.outputText).toBe('hello');
    expect(component.primarySuggestion?.id).toBe('b64-decoded');
  });

  it('supports utf-8 encoding', () => {
    component.selectMode('encode');
    component.inputText = 'café';
    component.onInputChange();
    expect(component.outputText).toBeTruthy();
    component.selectMode('decode');
    expect(component.outputText).toBe('café');
  });

  it('reports invalid base64', () => {
    component.selectMode('decode');
    component.inputText = 'not!!!base64';
    component.onInputChange();
    expect(component.errorMessage).toBeTruthy();
    expect(component.hasOutput).toBe(false);
    expect(component.primarySuggestion?.id).toBe('b64-invalid-decode');
  });

  it('suggests decode when encode input looks like Base64', () => {
    component.selectMode('encode');
    component.inputText = 'aGVsbG8=';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('b64-looks-encoded');
  });

  it('swaps mode and values', () => {
    component.selectMode('encode');
    component.inputText = 'hi';
    component.onInputChange();
    component.swapInputOutput();
    expect(component.mode).toBe('decode');
    expect(component.inputText).toBe('aGk=');
    expect(component.outputText).toBe('hi');
  });

  it('clears input and output with toast', () => {
    component.inputText = 'test';
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

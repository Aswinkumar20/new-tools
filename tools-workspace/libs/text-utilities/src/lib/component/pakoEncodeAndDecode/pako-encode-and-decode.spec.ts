import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { PakoEncodeAndDecodeComponent } from './pako-encode-and-decode';

describe('PakoEncodeAndDecodeComponent', () => {
  let component: PakoEncodeAndDecodeComponent;
  let fixture: ComponentFixture<PakoEncodeAndDecodeComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PakoEncodeAndDecodeComponent],
      providers: [...textToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PakoEncodeAndDecodeComponent);
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
    expect(component.mode).toBe('encode');
    expect(component.compressionFormat).toBe('deflate');
    expect(component.binaryEncoding).toBe('base64');
    expect(component.compressionLevel).toBe(6);
    expect(component.primarySuggestion?.id).toBe('pako-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('compresses text to base64 deflate', () => {
    component.selectMode('encode');
    component.setCompressionFormat('deflate');
    component.setBinaryEncoding('base64');
    component.inputText = 'hello world '.repeat(50);
    component.onInputChange();
    expect(component.hasOutput).toBe(true);
    expect(component.outputText.length).toBeGreaterThan(0);
    expect(component.outputBytes).toBeLessThan(component.inputBytes);
    expect(component.primarySuggestion?.id).toBe('pako-compressed');
  });

  it('round-trips compress and decompress', () => {
    component.inputText = 'The quick brown fox jumps over the lazy dog.';
    component.setCompressionFormat('gzip');
    component.setBinaryEncoding('base64');
    component.onInputChange();
    const compressed = component.outputText;

    component.selectMode('decode');
    component.inputText = compressed;
    component.onInputChange();
    expect(component.outputText).toBe('The quick brown fox jumps over the lazy dog.');
    expect(component.primarySuggestion?.id).toBe('pako-decompressed');
  });

  it('surfaces decompress errors', () => {
    component.selectMode('decode');
    component.setCompressionFormat('deflate');
    component.setBinaryEncoding('base64');
    component.inputText = '!!!not-valid!!!';
    component.onInputChange();
    expect(component.hasOutput).toBe(false);
    expect(component.errorMessage.length).toBeGreaterThan(0);
    expect(component.primarySuggestion?.id).toBe('pako-error');
  });

  it('clamps compression level', () => {
    component.selectMode('encode');
    component.inputText = 'abc';
    component.onInputChange();
    component.compressionLevel = 20;
    component.onLevelChange();
    expect(component.compressionLevel).toBe(9);
  });

  it('clears with toast feedback and resets stats', () => {
    component.inputText = 'hello world '.repeat(10);
    component.onInputChange();
    component.clear();
    expect(component.inputText).toBe('');
    expect(component.outputText).toBe('');
    expect(component.inputBytes).toBe(0);
    expect(component.outputBytes).toBe(0);
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

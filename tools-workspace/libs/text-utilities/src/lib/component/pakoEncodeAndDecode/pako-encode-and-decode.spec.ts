import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PakoEncodeAndDecodeComponent } from './pako-encode-and-decode';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('PakoEncodeAndDecodeComponent', () => {
  let component: PakoEncodeAndDecodeComponent;
  let fixture: ComponentFixture<PakoEncodeAndDecodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PakoEncodeAndDecodeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PakoEncodeAndDecodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
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
  });
});

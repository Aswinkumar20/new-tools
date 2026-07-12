import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Base64EncodeAndDecodeComponent } from './base64-encode-and-decode';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('Base64EncodeAndDecodeComponent', () => {
  let component: Base64EncodeAndDecodeComponent;
  let fixture: ComponentFixture<Base64EncodeAndDecodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Base64EncodeAndDecodeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Base64EncodeAndDecodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('encodes text to base64', () => {
    component.selectMode('encode');
    component.inputText = 'hello';
    component.onInputChange();
    expect(component.outputText).toBe('aGVsbG8=');
    expect(component.errorMessage).toBe('');
  });

  it('decodes base64 to text', () => {
    component.selectMode('decode');
    component.inputText = 'aGVsbG8=';
    component.onInputChange();
    expect(component.outputText).toBe('hello');
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

  it('clears input and output', () => {
    component.inputText = 'test';
    component.onInputChange();
    component.clear();
    expect(component.inputText).toBe('');
    expect(component.outputText).toBe('');
  });
});

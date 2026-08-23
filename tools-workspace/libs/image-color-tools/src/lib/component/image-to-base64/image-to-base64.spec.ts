import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { ImageToBase64Component } from './image-to-base64';

describe('ImageToBase64Component', () => {
  let component: ImageToBase64Component;
  let fixture: ComponentFixture<ImageToBase64Component>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: jest.fn(() => 'blob:mock')
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: jest.fn()
    });

    await TestBed.configureTestingModule({
      imports: [ImageToBase64Component],
      providers: [...ictToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ImageToBase64Component);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with related tools and start suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()?.id).toBe('itb-start');
    expect(component.hasResult()).toBe(false);
  });

  it('rejects unsupported files', async () => {
    await component.handleFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    expect(component.errors()[0]).toContain('Unsupported');
    expect(component.selectedFile()).toBeNull();
  });

  it('encodes a small image file', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const file = new File([bytes], 'tiny.png', { type: 'image/png' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
    });
    await component.handleFile(file);
    expect(component.selectedFile()).toBe(file);
    expect(component.errors()).toEqual([]);
    expect(component.result()?.filename).toBe('tiny.png');
    expect(component.result()?.textPreview.length).toBeGreaterThan(0);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('copies encoded output with toast feedback', async () => {
    component.result.set({
      dataUri: 'data:image/png;base64,aaa',
      textPreview: 'aaa',
      size: 3,
      encodedSize: 3,
      compressionRatio: 1,
      previewUrl: 'safe' as never,
      filename: 'a.png',
      mime: 'image/png',
      outputFormat: 'base64',
      chunks: ['aaa']
    });
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyToClipboard();
    expect(toast.info).toHaveBeenCalledWith('Encoded output copied to clipboard');
  });
});

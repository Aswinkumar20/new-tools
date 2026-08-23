import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { ImageToTextComponent } from './image-to-text';

const mockWorker = {
  loadLanguage: jest.fn().mockResolvedValue(undefined),
  initialize: jest.fn().mockResolvedValue(undefined),
  setParameters: jest.fn().mockResolvedValue(undefined),
  recognize: jest.fn().mockResolvedValue({ data: { text: 'hello world', confidence: 88.7 } }),
  terminate: jest.fn().mockResolvedValue(undefined)
};

jest.mock('tesseract.js', () => ({
  createWorker: jest.fn().mockResolvedValue(mockWorker)
}));

describe('ImageToTextComponent', () => {
  let component: ImageToTextComponent;
  let fixture: ComponentFixture<ImageToTextComponent>;
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

    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ImageToTextComponent],
      providers: [...ictToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ImageToTextComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create with related tools and a start suggestion', async () => {
    expect(component).toBeTruthy();
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()).toBeTruthy();
    expect(component.currentLanguageName()).toBe('English');
  });

  it('rejects non-image files', async () => {
    await component.handleFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    expect(component.errors()[0]).toContain('valid image');
    expect(component.selectedFile()).toBeNull();
  });

  it('extracts text via mocked Tesseract', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'shot.png', { type: 'image/png' });
    await component.handleFile(file);
    expect(component.selectedFile()).toBe(file);
    expect(component.result()?.text).toBe('hello world');
    expect(component.result()?.words).toBe(2);
    expect(component.result()?.confidence).toBe(89);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('copies extracted text with toast feedback', async () => {
    component.result.set({
      text: 'copied',
      confidence: 90,
      words: 1,
      characters: 6,
      lines: 1,
      previewUrl: 'safe' as never,
      filename: 'a.png',
      processingTime: 12
    });
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyToClipboard();
    expect(toast.info).toHaveBeenCalledWith('Extracted text copied to clipboard');
  });
});

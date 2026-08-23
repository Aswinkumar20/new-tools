import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { ImageCompressorComponent } from './image-compressor';

describe('ImageCompressorComponent', () => {
  let component: ImageCompressorComponent;
  let fixture: ComponentFixture<ImageCompressorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageCompressorComponent],
      providers: [...ictToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ImageCompressorComponent);
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
    expect(component.primarySuggestion()?.id).toBe('icomp-start');
    expect(component.canCompress()).toBe(false);
  });

  it('applies compression presets', () => {
    const preset = component.presets[1];
    component.applyPreset(preset);
    expect(component.form.controls.quality.value).toBe(preset.quality);
    expect(component.form.controls.format.value).toBe(preset.format);
  });

  it('rejects non-image files', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    await (component as unknown as { loadFile: (f: File) => Promise<void> }).loadFile(file);
    expect(component.errors()[0]).toContain('valid image');
    expect(component.selectedFile()).toBeNull();
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('downloads with toast when a result exists', () => {
    component.result.set({
      originalName: 'shot.png',
      originalSize: 1000,
      originalDimensions: { width: 10, height: 10 },
      compressedSize: 400,
      compressedDimensions: { width: 10, height: 10 },
      reduction: 0.4,
      previewUrl: 'safe' as never,
      downloadUrl: 'blob:test',
      format: 'image/jpeg'
    });

    const click = jest.fn();
    const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click
    } as unknown as HTMLAnchorElement);

    component.download();

    expect(click).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Compressed image downloaded');
    createElementSpy.mockRestore();
  });
});

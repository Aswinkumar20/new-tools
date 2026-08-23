import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { ImageResizerComponent } from './image-resizer';

describe('ImageResizerComponent', () => {
  let component: ImageResizerComponent;
  let fixture: ComponentFixture<ImageResizerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageResizerComponent],
      providers: [...ictToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ImageResizerComponent);
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
    expect(component.primarySuggestion()?.id).toBe('ires-start');
    expect(component.canResize()).toBe(false);
  });

  it('applies resize presets', () => {
    const preset = component.presets[1];
    component.applyPreset(preset);
    expect(component.form.controls.width.value).toBe(preset.width);
    expect(component.form.controls.height.value).toBe(preset.height);
    expect(component.form.controls.keepAspect.value).toBe(preset.lockAspect);
  });

  it('rejects non-image files', async () => {
    await component.loadFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
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
      originalDimensions: { width: 100, height: 50 },
      resizedSize: 400,
      resizedDimensions: { width: 50, height: 25 },
      ratioChange: 0.4,
      previewUrl: 'safe' as never,
      downloadUrl: 'blob:test',
      format: 'image/png'
    });

    const click = jest.fn();
    const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click
    } as unknown as HTMLAnchorElement);

    component.download();

    expect(click).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Resized image downloaded');
    createElementSpy.mockRestore();
  });
});

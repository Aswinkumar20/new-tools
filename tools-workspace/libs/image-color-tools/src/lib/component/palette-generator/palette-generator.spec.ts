import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { PaletteGeneratorComponent } from './palette-generator';

describe('PaletteGeneratorComponent', () => {
  let component: PaletteGeneratorComponent;
  let fixture: ComponentFixture<PaletteGeneratorComponent>;
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
      imports: [PaletteGeneratorComponent],
      providers: [...ictToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PaletteGeneratorComponent);
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
    expect(component.primarySuggestion()?.id).toBe('pg-start');
    expect(component.currentMethodLabel()).toBe('Dominant colors');
  });

  it('rejects non-image files', async () => {
    await component.handleFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
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

  it('copies HEX with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyToClipboard('#FA0000', 'HEX');
    expect(toast.info).toHaveBeenCalledWith('HEX copied to clipboard');
  });

  it('downloads CSS with toast when a result exists', () => {
    component.result.set({
      colors: [
        {
          hex: '#FA0000',
          rgb: { r: 250, g: 0, b: 0 },
          hsl: { h: 0, s: 100, l: 49 },
          percentage: 100
        }
      ],
      previewUrl: 'safe' as never,
      filename: 'shot.png',
      method: 'Dominant colors',
      colorCount: 1
    });

    const click = jest.fn();
    const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click
    } as unknown as HTMLAnchorElement);

    component.downloadPalette();

    expect(click).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Palette CSS downloaded');
    createElementSpy.mockRestore();
  });
});

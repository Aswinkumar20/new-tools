import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { FontViewerComponent } from './font-viewer';

describe('FontViewerComponent', () => {
  let component: FontViewerComponent;
  let fixture: ComponentFixture<FontViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FontViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FontViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with color suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.relatedTools.length).toBeGreaterThan(0);
    if (component.fontApiSupported) {
      expect(component.primarySuggestion?.id).toBe('fn-color');
    } else {
      expect(component.primarySuggestion?.id).toBe('fn-meta-unsupported');
    }
  });

  it('resets preview controls to defaults', () => {
    component.fontSize = 120;
    component.lineHeight = 2;
    component.uppercase = true;
    component.resetPreviewControls();
    expect(component.fontSize).toBe(48);
    expect(component.lineHeight).toBe(1.3);
    expect(component.uppercase).toBe(false);
  });

  it('applies templates and marks custom sample text', () => {
    component.onTemplateSelect('headline');
    expect(component.selectedTemplateId).toBe('headline');
    expect(component.sampleText).toContain('Elevate');
    component.onSampleTextInput('Custom copy');
    expect(component.selectedTemplateId).toBe('custom');
    expect(component.activeTemplateLabel).toBe('Custom');
  });

  it('downloads font with toast feedback', () => {
    component.downloadUrl = 'blob:mock';
    component.fontMetadata = {
      fileName: 'Brand.woff2',
      formattedSize: '12 KB',
      rawSize: 12000,
      mimeType: 'font/woff2',
      formatLabel: 'Web Open Font Format 2 (.woff2)',
      lastModified: 'Jan 1, 2024',
      family: 'Brand',
      style: 'normal',
      weight: '400',
      stretch: 'normal'
    };

    const click = jest.fn();
    const createElement = jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    }) as typeof document.createElement);

    try {
      component.downloadFont();
      expect(click).toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalled();
    } finally {
      createElement.mockRestore();
      component.downloadUrl = undefined;
      component.fontMetadata = undefined;
    }
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('clears loaded font state', () => {
    component.fontLoaded = true;
    component.loadError = 'x';
    component.fontMetadata = {
      fileName: 'a.ttf',
      formattedSize: '1 B',
      rawSize: 1,
      mimeType: 'font/ttf',
      formatLabel: 'TrueType Font (.ttf)',
      lastModified: 'Jan 1, 2024',
      family: 'A',
      style: 'normal',
      weight: '400',
      stretch: 'normal'
    };
    component.clearFont();
    expect(component.fontLoaded).toBe(false);
    expect(component.fontMetadata).toBeUndefined();
    expect(component.loadError).toBeNull();
  });
});

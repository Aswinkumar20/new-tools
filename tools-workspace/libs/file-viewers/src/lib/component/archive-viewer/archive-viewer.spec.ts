import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { ArchiveViewerComponent } from './archive-viewer';

describe('ArchiveViewerComponent', () => {
  let component: ArchiveViewerComponent;
  let fixture: ComponentFixture<ArchiveViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchiveViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ArchiveViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create with metadata suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('av-meta');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('rejects invalid files before loading', async () => {
    component['JSZipLib'] = {} as never;
    await component.handleFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.errorMessage).toContain('valid archive');
  });

  it('reports unsupported non-ZIP formats', async () => {
    component['JSZipLib'] = {} as never;
    await component.handleFiles([new File(['x'], 'pack.rar')]);
    expect(component.errorMessage).toContain('not fully supported');
    expect(component.primarySuggestion?.id).toBe('av-zip-only');
  });

  it('copies preview text via toast clipboard helper', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) }
    });

    component.previewType = 'text';
    component.previewContent = '{"ok":true}';
    component.previewFileName = 'data.json';
    await component.copyPreviewText();
    expect(toast.info).toHaveBeenCalled();
    expect(component.hasCopiedPreview).toBe(true);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('av-meta');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('clears archive state', () => {
    component.archiveFiles = [
      {
        name: 'a.zip',
        file: new File([''], 'a.zip'),
        size: 1,
        format: '.zip',
        totalFiles: 1,
        totalSize: 1,
        compressedSize: 1,
        passwordProtected: false,
        loaded: true
      }
    ];
    component.currentArchiveIndex = 0;
    component.clearAll();
    expect(component.archiveFiles).toEqual([]);
    expect(component.currentArchiveIndex).toBe(-1);
  });
});

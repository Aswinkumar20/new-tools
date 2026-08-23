import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { cftToolTestProviders } from '../../shared/cft-tool-test.utils';
import { FileMetadataViewerComponent } from './file-metadata-viewer';

describe('FileMetadataViewerComponent', () => {
  let component: FileMetadataViewerComponent;
  let fixture: ComponentFixture<FileMetadataViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileMetadataViewerComponent],
      providers: [...cftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FileMetadataViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with empty state', () => {
    expect(component).toBeTruthy();
    expect(component.hasFiles()).toBe(false);
    expect(component.primarySuggestion()?.id).toBe('empty-files');
  });

  it('loads a text file via input change and builds metadata', async () => {
    const file = new File(['line1\nline2'], 'readme.txt', { type: 'text/plain' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });

    await component.onFileInputChange({ target: input } as unknown as Event);

    expect(component.hasFiles()).toBe(true);
    expect(component.selectedFile()?.name).toBe('readme.txt');
    expect(component.metadataText()).toContain('Name: readme.txt');
    expect(component.metadataText()).toContain('MIME: text/plain');
  });

  it('selects, removes, and clears files', async () => {
    const first = new File(['a'], 'a.txt', { type: 'text/plain' });
    const second = new File(['b'], 'b.txt', { type: 'text/plain' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [first, second] });

    await component.onFileInputChange({ target: input } as unknown as Event);
    expect(component.files().length).toBe(2);

    const selected = component.selectedFile()!;
    component.removeFile(selected);
    expect(component.files().length).toBe(1);
    expect(component.selectedFile()).toBeTruthy();

    component.clearAll();
    expect(component.hasFiles()).toBe(false);
    expect(component.selectedFile()).toBeNull();
  });

  it('suggests image tooling for image files', async () => {
    const file = new File(['fake'], 'photo.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });

    await component.onFileInputChange({ target: input } as unknown as Event);
    expect(component.primarySuggestion()?.path).toBe('/image-color-tools/image-to-base64');
  });

  it('dismisses the active suggestion', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });
});

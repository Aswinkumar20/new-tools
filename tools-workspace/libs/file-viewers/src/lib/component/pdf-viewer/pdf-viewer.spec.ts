import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileViewerPdfViewerComponent } from './pdf-viewer';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';

describe('FileViewerPdfViewerComponent', () => {
  let component: FileViewerPdfViewerComponent;
  let fixture: ComponentFixture<FileViewerPdfViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileViewerPdfViewerComponent],
      providers: fileViewerTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(FileViewerPdfViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

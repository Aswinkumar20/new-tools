import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileViewerWordViewerComponent } from './word-viewer';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';

describe('FileViewerWordViewerComponent', () => {
  let component: FileViewerWordViewerComponent;
  let fixture: ComponentFixture<FileViewerWordViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileViewerWordViewerComponent],
      providers: fileViewerTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(FileViewerWordViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

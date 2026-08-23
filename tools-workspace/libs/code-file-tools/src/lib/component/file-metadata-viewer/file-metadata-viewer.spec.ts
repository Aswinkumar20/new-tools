import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileMetadataViewerComponent } from './file-metadata-viewer';

describe('FileMetadataViewerComponent', () => {
  let component: FileMetadataViewerComponent;
  let fixture: ComponentFixture<FileMetadataViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileMetadataViewerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FileMetadataViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

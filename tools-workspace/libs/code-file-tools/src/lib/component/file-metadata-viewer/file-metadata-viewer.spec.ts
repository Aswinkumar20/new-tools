import { ComponentFixture, TestBed } from '@angular/core/testing';
import { cftToolTestProviders } from '../../shared/cft-tool-test.utils';
import { FileMetadataViewerComponent } from './file-metadata-viewer';

describe('FileMetadataViewerComponent', () => {
  let component: FileMetadataViewerComponent;
  let fixture: ComponentFixture<FileMetadataViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileMetadataViewerComponent],
      providers: cftToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(FileMetadataViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

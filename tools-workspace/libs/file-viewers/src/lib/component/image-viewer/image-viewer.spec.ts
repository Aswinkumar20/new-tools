import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageViewerComponent } from './image-viewer';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';

describe('ImageViewerComponent', () => {
  let component: ImageViewerComponent;
  let fixture: ComponentFixture<ImageViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageViewerComponent],
      providers: fileViewerTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(ImageViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reports empty gallery stats', () => {
    expect(component.activeIndexLabel).toBe('—');
    expect(component.currentFormatLabel).toBe('—');
    expect(component.images.length).toBe(0);
  });
});

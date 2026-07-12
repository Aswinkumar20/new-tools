import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { ImageCompressorComponent } from './image-compressor';

describe('ImageCompressorComponent', () => {
  let component: ImageCompressorComponent;
  let fixture: ComponentFixture<ImageCompressorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageCompressorComponent],
      providers: ictToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(ImageCompressorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

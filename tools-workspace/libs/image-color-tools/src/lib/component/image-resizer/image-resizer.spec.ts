import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { ImageResizerComponent } from './image-resizer';

describe('ImageResizerComponent', () => {
  let component: ImageResizerComponent;
  let fixture: ComponentFixture<ImageResizerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageResizerComponent],
      providers: ictToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(ImageResizerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

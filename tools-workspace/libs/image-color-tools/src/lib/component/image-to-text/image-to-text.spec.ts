import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { ImageToTextComponent } from './image-to-text';

describe('ImageToTextComponent', () => {
  let component: ImageToTextComponent;
  let fixture: ComponentFixture<ImageToTextComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageToTextComponent],
      providers: ictToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(ImageToTextComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

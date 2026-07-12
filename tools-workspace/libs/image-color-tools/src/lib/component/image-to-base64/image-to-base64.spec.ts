import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { ImageToBase64Component } from './image-to-base64';

describe('ImageToBase64Component', () => {
  let component: ImageToBase64Component;
  let fixture: ComponentFixture<ImageToBase64Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageToBase64Component],
      providers: ictToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(ImageToBase64Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

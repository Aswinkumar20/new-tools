import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { ImageToPdfComponent } from './image-to-pdf';

describe('ImageToPdfComponent', () => {
  let fixture: ComponentFixture<ImageToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageToPdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(ImageToPdfComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

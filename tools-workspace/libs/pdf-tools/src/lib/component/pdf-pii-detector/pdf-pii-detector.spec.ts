import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfPiiDetectorComponent } from './pdf-pii-detector';

describe('PdfPiiDetectorComponent', () => {
  let fixture: ComponentFixture<PdfPiiDetectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfPiiDetectorComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfPiiDetectorComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

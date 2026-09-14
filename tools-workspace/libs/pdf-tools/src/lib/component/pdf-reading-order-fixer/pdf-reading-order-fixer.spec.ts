import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfReadingOrderFixerComponent } from './pdf-reading-order-fixer';

describe('PdfReadingOrderFixerComponent', () => {
  let fixture: ComponentFixture<PdfReadingOrderFixerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfReadingOrderFixerComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfReadingOrderFixerComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

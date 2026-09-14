import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfToTxtComponent } from './pdf-to-txt';

describe('PdfToTxtComponent', () => {
  let fixture: ComponentFixture<PdfToTxtComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfToTxtComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfToTxtComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

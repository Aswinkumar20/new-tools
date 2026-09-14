import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfRedactionFinderComponent } from './pdf-redaction-finder';

describe('PdfRedactionFinderComponent', () => {
  let fixture: ComponentFixture<PdfRedactionFinderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfRedactionFinderComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfRedactionFinderComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

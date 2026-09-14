import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfHeaderFooterComponent } from './pdf-header-footer';

describe('PdfHeaderFooterComponent', () => {
  let fixture: ComponentFixture<PdfHeaderFooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfHeaderFooterComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfHeaderFooterComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

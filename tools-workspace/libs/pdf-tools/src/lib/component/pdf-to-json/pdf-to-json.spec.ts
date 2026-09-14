import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfToJsonComponent } from './pdf-to-json';

describe('PdfToJsonComponent', () => {
  let fixture: ComponentFixture<PdfToJsonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfToJsonComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfToJsonComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

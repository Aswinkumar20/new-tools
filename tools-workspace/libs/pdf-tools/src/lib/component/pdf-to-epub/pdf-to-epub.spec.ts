import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfToEpubComponent } from './pdf-to-epub';

describe('PdfToEpubComponent', () => {
  let fixture: ComponentFixture<PdfToEpubComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfToEpubComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfToEpubComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

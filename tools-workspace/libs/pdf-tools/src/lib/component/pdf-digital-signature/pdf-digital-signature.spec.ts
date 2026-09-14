import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfDigitalSignatureComponent } from './pdf-digital-signature';

describe('PdfDigitalSignatureComponent', () => {
  let fixture: ComponentFixture<PdfDigitalSignatureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfDigitalSignatureComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfDigitalSignatureComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfToBase64Component } from './pdf-to-base64';

describe('PdfToBase64Component', () => {
  let component: PdfToBase64Component;
  let fixture: ComponentFixture<PdfToBase64Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfToBase64Component],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfToBase64Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

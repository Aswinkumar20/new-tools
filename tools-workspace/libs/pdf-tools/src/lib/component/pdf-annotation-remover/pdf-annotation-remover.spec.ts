import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfAnnotationRemoverComponent } from './pdf-annotation-remover';

describe('PdfAnnotationRemoverComponent', () => {
  let fixture: ComponentFixture<PdfAnnotationRemoverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfAnnotationRemoverComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfAnnotationRemoverComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

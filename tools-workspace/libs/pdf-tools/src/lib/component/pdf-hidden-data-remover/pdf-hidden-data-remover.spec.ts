import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfHiddenDataRemoverComponent } from './pdf-hidden-data-remover';

describe('PdfHiddenDataRemoverComponent', () => {
  let fixture: ComponentFixture<PdfHiddenDataRemoverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfHiddenDataRemoverComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfHiddenDataRemoverComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

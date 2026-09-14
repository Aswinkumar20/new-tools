import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfMetadataRemoverComponent } from './pdf-metadata-remover';

describe('PdfMetadataRemoverComponent', () => {
  let fixture: ComponentFixture<PdfMetadataRemoverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfMetadataRemoverComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfMetadataRemoverComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

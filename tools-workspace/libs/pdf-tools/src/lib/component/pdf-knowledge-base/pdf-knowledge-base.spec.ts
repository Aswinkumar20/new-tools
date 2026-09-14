import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfKnowledgeBaseComponent } from './pdf-knowledge-base';

describe('PdfKnowledgeBaseComponent', () => {
  let fixture: ComponentFixture<PdfKnowledgeBaseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfKnowledgeBaseComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfKnowledgeBaseComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

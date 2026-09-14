import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { MarkdownToPdfComponent } from './markdown-to-pdf';

describe('MarkdownToPdfComponent', () => {
  let fixture: ComponentFixture<MarkdownToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownToPdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownToPdfComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

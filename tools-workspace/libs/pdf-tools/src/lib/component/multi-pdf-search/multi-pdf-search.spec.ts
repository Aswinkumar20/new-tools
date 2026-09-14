import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { MultiPdfSearchComponent } from './multi-pdf-search';

describe('MultiPdfSearchComponent', () => {
  let fixture: ComponentFixture<MultiPdfSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiPdfSearchComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(MultiPdfSearchComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

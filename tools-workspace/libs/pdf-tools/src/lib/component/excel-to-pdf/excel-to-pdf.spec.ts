import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { ExcelToPdfComponent } from './excel-to-pdf';

describe('ExcelToPdfComponent', () => {
  let fixture: ComponentFixture<ExcelToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExcelToPdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(ExcelToPdfComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { ChartsToPdfComponent } from './charts-to-pdf';

describe('ChartsToPdfComponent', () => {
  let fixture: ComponentFixture<ChartsToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartsToPdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(ChartsToPdfComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

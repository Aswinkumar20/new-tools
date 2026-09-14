import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { TablesToPdfComponent } from './tables-to-pdf';

describe('TablesToPdfComponent', () => {
  let fixture: ComponentFixture<TablesToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TablesToPdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(TablesToPdfComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

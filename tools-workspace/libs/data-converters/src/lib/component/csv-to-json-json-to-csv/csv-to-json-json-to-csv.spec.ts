import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CsvToJsonJsonToCsvComponent } from './csv-to-json-json-to-csv';

describe('CsvToJsonJsonToCsvComponent', () => {
  let component: CsvToJsonJsonToCsvComponent;
  let fixture: ComponentFixture<CsvToJsonJsonToCsvComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CsvToJsonJsonToCsvComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CsvToJsonJsonToCsvComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

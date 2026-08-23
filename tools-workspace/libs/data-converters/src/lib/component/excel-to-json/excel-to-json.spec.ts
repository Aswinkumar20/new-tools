import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExcelToJsonComponent } from './excel-to-json';

describe('ExcelToJsonComponent', () => {
  let component: ExcelToJsonComponent;
  let fixture: ComponentFixture<ExcelToJsonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExcelToJsonComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ExcelToJsonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

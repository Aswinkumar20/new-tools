import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TablesChartsToPdfComponent } from './tables-charts-to-pdf';

describe('TablesChartsToPdfComponent', () => {
  let component: TablesChartsToPdfComponent;
  let fixture: ComponentFixture<TablesChartsToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TablesChartsToPdfComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TablesChartsToPdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

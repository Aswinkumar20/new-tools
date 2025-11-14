import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HtmlTableExporterComponent } from './html-table-exporter';

describe('HtmlTableExporterComponent', () => {
  let component: HtmlTableExporterComponent;
  let fixture: ComponentFixture<HtmlTableExporterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HtmlTableExporterComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(HtmlTableExporterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { cftToolTestProviders } from '../../shared/cft-tool-test.utils';
import { HtmlTableExporterComponent } from './html-table-exporter';

describe('HtmlTableExporterComponent', () => {
  let component: HtmlTableExporterComponent;
  let fixture: ComponentFixture<HtmlTableExporterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HtmlTableExporterComponent],
      providers: cftToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(HtmlTableExporterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

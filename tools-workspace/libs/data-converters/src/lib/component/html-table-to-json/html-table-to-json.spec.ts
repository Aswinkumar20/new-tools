import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HtmlTableToJsonComponent } from './html-table-to-json';
import { converterTestProviders } from '../../shared/converter-test.utils';

describe('HtmlTableToJsonComponent', () => {
  let component: HtmlTableToJsonComponent;
  let fixture: ComponentFixture<HtmlTableToJsonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HtmlTableToJsonComponent],
      providers: converterTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(HtmlTableToJsonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

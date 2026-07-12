import { ComponentFixture, TestBed } from '@angular/core/testing';
import { cftToolTestProviders } from '../../shared/cft-tool-test.utils';
import { HtmlMinifierComponent } from './html-minifier';

describe('HtmlMinifierComponent', () => {
  let component: HtmlMinifierComponent;
  let fixture: ComponentFixture<HtmlMinifierComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HtmlMinifierComponent],
      providers: cftToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(HtmlMinifierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { cftToolTestProviders } from '../../shared/cft-tool-test.utils';
import { HtmlEntityEncoderComponent } from './html-entity-encoder';

describe('HtmlEntityEncoderComponent', () => {
  let component: HtmlEntityEncoderComponent;
  let fixture: ComponentFixture<HtmlEntityEncoderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HtmlEntityEncoderComponent],
      providers: cftToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(HtmlEntityEncoderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { MotivationalQuoteGeneratorComponent } from './motivational-quote-generator';

describe('MotivationalQuoteGeneratorComponent', () => {
  let component: MotivationalQuoteGeneratorComponent;
  let fixture: ComponentFixture<MotivationalQuoteGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MotivationalQuoteGeneratorComponent],
      providers: ftToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(MotivationalQuoteGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

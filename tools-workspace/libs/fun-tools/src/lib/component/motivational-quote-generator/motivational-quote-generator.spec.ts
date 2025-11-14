import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MotivationalQuoteGeneratorComponent } from './motivational-quote-generator';

describe('MotivationalQuoteGeneratorComponent', () => {
  let component: MotivationalQuoteGeneratorComponent;
  let fixture: ComponentFixture<MotivationalQuoteGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MotivationalQuoteGeneratorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MotivationalQuoteGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

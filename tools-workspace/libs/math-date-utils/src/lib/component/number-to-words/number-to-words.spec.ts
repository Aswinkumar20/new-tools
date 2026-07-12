import { ComponentFixture, TestBed } from '@angular/core/testing';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { NumberToWordsComponent } from './number-to-words';

describe('NumberToWordsComponent', () => {
  let component: NumberToWordsComponent;
  let fixture: ComponentFixture<NumberToWordsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NumberToWordsComponent],
      providers: mathToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(NumberToWordsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

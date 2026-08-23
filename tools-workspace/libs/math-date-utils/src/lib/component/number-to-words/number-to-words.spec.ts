import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NumberToWordsComponent } from './number-to-words';

describe('NumberToWordsComponent', () => {
  let component: NumberToWordsComponent;
  let fixture: ComponentFixture<NumberToWordsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NumberToWordsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(NumberToWordsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

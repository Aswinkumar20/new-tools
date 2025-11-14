import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WordsAndCharacterCounterComponent } from './wordsAndCharacterCounter.component';

describe('WordsAndCharacterCounterComponent', () => {
  let component: WordsAndCharacterCounterComponent;
  let fixture: ComponentFixture<WordsAndCharacterCounterComponent >;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordsAndCharacterCounterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WordsAndCharacterCounterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

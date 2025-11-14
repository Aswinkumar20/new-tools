import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WordViewerComponent } from './word-viewer';

describe('WordViewerComponent', () => {
  let component: WordViewerComponent;
  let fixture: ComponentFixture<WordViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordViewerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(WordViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

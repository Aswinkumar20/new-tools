import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioTrimmerComponent } from './audio-trimmer';

describe('AudioTrimmerComponent', () => {
  let component: AudioTrimmerComponent;
  let fixture: ComponentFixture<AudioTrimmerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioTrimmerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AudioTrimmerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

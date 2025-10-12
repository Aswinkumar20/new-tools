import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextToASCII } from './text-to-ASCII';

describe('TextToASCII', () => {
  let component: TextToASCII;
  let fixture: ComponentFixture<TextToASCII>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TextToASCII],
    }).compileComponents();

    fixture = TestBed.createComponent(TextToASCII);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

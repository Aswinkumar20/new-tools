import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextCaseConvertor } from './text-case-convertor';

describe('TextCaseConvertor', () => {
  let component: TextCaseConvertor;
  let fixture: ComponentFixture<TextCaseConvertor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TextCaseConvertor],
    }).compileComponents();

    fixture = TestBed.createComponent(TextCaseConvertor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

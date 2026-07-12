import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buToolTestProviders } from '../../shared/bu-tool-test.utils';
import { CookieEditorComponent } from './cookie-editor';

describe('CookieEditorComponent', () => {
  let component: CookieEditorComponent;
  let fixture: ComponentFixture<CookieEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CookieEditorComponent],
      providers: buToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(CookieEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

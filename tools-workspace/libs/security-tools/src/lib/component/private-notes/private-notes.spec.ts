import { ComponentFixture, TestBed } from '@angular/core/testing';
import { stToolTestProviders } from '../../shared/st-tool-test.utils';
import { PrivateNotesComponent } from './private-notes';

describe('PrivateNotesComponent', () => {
  let component: PrivateNotesComponent;
  let fixture: ComponentFixture<PrivateNotesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivateNotesComponent],
      providers: stToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PrivateNotesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

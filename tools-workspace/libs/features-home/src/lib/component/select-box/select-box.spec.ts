import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectBoxComponent } from './select-box';

describe('SelectBoxComponent', () => {
  let fixture: ComponentFixture<SelectBoxComponent<string>>;
  let component: SelectBoxComponent<string>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectBoxComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SelectBoxComponent<string>);
    component = fixture.componentInstance;
    component.options = [
      { label: 'All activities', value: 'all' },
      { label: 'Review', value: 'review' }
    ];
    fixture.detectChanges();
  });

  it('opens as a bounded custom menu and selects an option', () => {
    const onChange = jest.fn();
    component.registerOnChange(onChange);

    component.toggle(new MouseEvent('click'));
    fixture.detectChanges();
    expect(component.open).toBe(true);
    expect(fixture.nativeElement.querySelector('.select-box__panel')).toBeTruthy();

    component.select(component.options[1]);
    fixture.detectChanges();
    expect(component.value).toBe('review');
    expect(onChange).toHaveBeenCalledWith('review');
    expect(component.open).toBe(false);
  });

  it('supports keyboard navigation', () => {
    component.writeValue('all');
    component.onTriggerKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(component.open).toBe(true);
    expect(component.activeIndex).toBe(1);
  });
});

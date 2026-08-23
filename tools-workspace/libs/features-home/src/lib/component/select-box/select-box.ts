import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  forwardRef,
  inject
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectBoxOption<T = string> {
  label: string;
  value: T;
  description?: string;
  disabled?: boolean;
}

let selectBoxId = 0;

@Component({
  selector: 'lib-select-box',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './select-box.html',
  styleUrl: './select-box.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectBoxComponent),
      multi: true
    }
  ]
})
export class SelectBoxComponent<T = string> implements ControlValueAccessor {
  @Input() options: ReadonlyArray<SelectBoxOption<T>> = [];
  @Input() placeholder = 'Select an option';
  @Input() ariaLabel = 'Select an option';
  @Input() emptyText = 'No options available';

  readonly listboxId = `select-box-${++selectBoxId}`;
  open = false;
  disabled = false;
  value: T | null = null;
  activeIndex = -1;

  private readonly cdr = inject(ChangeDetectorRef);
  private onChange: (value: T | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  get selectedOption(): SelectBoxOption<T> | undefined {
    return this.options.find((option) => Object.is(option.value, this.value));
  }

  toggle(event: Event): void {
    event.stopPropagation();
    if (this.disabled) {
      return;
    }
    if (this.open) {
      this.close();
    } else {
      this.openMenu();
    }
  }

  select(option: SelectBoxOption<T>, event?: Event): void {
    event?.stopPropagation();
    if (option.disabled) {
      return;
    }
    this.value = option.value;
    this.onChange(option.value);
    this.onTouched();
    this.close();
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.openMenu();
        this.moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.openMenu();
        this.moveActive(-1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.open && this.activeIndex >= 0) {
          this.select(this.options[this.activeIndex]);
        } else {
          this.openMenu();
        }
        break;
      case 'Escape':
        if (this.open) {
          event.preventDefault();
          this.close();
        }
        break;
      case 'Home':
        if (this.open) {
          event.preventDefault();
          this.setFirstEnabled();
        }
        break;
      case 'End':
        if (this.open) {
          event.preventDefault();
          this.setLastEnabled();
        }
        break;
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.close();
  }

  writeValue(value: T | null): void {
    this.value = value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: T | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  markTouched(): void {
    this.onTouched();
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    if (disabled) {
      this.close();
    }
    this.cdr.markForCheck();
  }

  trackByValue(_index: number, option: SelectBoxOption<T>): T {
    return option.value;
  }

  private openMenu(): void {
    if (this.open) {
      return;
    }
    this.open = true;
    const selectedIndex = this.options.findIndex(
      (option) => !option.disabled && Object.is(option.value, this.value)
    );
    this.activeIndex = selectedIndex >= 0 ? selectedIndex : this.firstEnabledIndex();
    this.cdr.markForCheck();
  }

  private close(): void {
    if (!this.open) {
      return;
    }
    this.open = false;
    this.activeIndex = -1;
    this.cdr.markForCheck();
  }

  private moveActive(direction: 1 | -1): void {
    if (this.options.length === 0) {
      return;
    }
    const candidates = Array.from({ length: this.options.length }, (_, offset) => {
      const distance = offset + 1;
      return (
        (this.activeIndex + direction * distance + this.options.length * 2) %
        this.options.length
      );
    });
    const next = candidates.find((index) => !this.options[index].disabled);
    if (next !== undefined) {
      this.activeIndex = next;
    }
    this.cdr.markForCheck();
  }

  private firstEnabledIndex(): number {
    return this.options.findIndex((option) => !option.disabled);
  }

  private setFirstEnabled(): void {
    this.activeIndex = this.firstEnabledIndex();
    this.cdr.markForCheck();
  }

  private setLastEnabled(): void {
    const reversedIndex = [...this.options].reverse().findIndex((option) => !option.disabled);
    this.activeIndex =
      reversedIndex < 0 ? -1 : this.options.length - reversedIndex - 1;
    this.cdr.markForCheck();
  }
}

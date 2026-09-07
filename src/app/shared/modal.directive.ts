import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
} from '@angular/core';
/** Focus management for the two conditionally mounted roster/team sheets. */
@Directive({ selector: '[appModal]' })
export class ModalDirective implements AfterViewInit, OnDestroy {
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly previous = document.activeElement as HTMLElement | null;
  private controls() {
    return Array.from(
      this.element.nativeElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
      ),
    ).filter((el) => el.getClientRects().length > 0);
  }
  ngAfterViewInit() {
    queueMicrotask(() => {
      const input = this.element.nativeElement.querySelector<HTMLInputElement>('input');
      (input ?? this.controls()[0])?.focus();
    });
  }
  @HostListener('keydown', ['$event']) keydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const controls = this.controls();
    const first = controls[0],
      last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  ngOnDestroy() {
    this.previous?.focus();
  }
}

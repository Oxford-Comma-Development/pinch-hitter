import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrivacyComponent } from './privacy.component';

describe('PrivacyComponent', () => {
  it('renders privacy policy heading and key disclosures', () => {
    TestBed.configureTestingModule({
      imports: [PrivacyComponent],
      providers: [provideRouter([])],
    });

    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Privacy Policy.');
    expect(compiled.textContent).toContain('100% On-Device');
    expect(compiled.textContent).toContain('Zero Tracking');
    expect(compiled.textContent).toContain('No Google Analytics');
    expect(compiled.textContent).toContain('No Account Needed');
    expect(compiled.textContent).toContain('Microphone & Voice Input');
    expect(compiled.textContent).toContain('How to Delete Your Data');
  });

  it('provides navigation links back to settings and home', () => {
    TestBed.configureTestingModule({
      imports: [PrivacyComponent],
      providers: [provideRouter([])],
    });

    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll('a')).map((a) => ({
      text: a.textContent?.trim(),
      routerLink: a.getAttribute('routerLink') ?? a.getAttribute('href'),
    }));

    expect(links.some((l) => l.routerLink === '/settings')).toBe(true);
    expect(links.some((l) => l.routerLink === '/')).toBe(true);
  });
});

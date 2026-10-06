import { Component, inject, input, signal } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import {
  activationLink,
  canShareText,
  copyText,
  emailToSelfHref,
  shareActivationLink,
} from './license-sharing';

/** "Keep your unlock code": copy, email to yourself, or share — so Pro can follow the coach. */
@Component({
  selector: 'app-keep-code',
  imports: [TranslatePipe],
  template: `
    <div class="keep-actions">
      <button type="button" (click)="copy()">{{ 'pro.keep.copy' | t }}</button>
      <a class="button" [href]="emailHref()">{{ 'pro.keep.email' | t }}</a>
      @if (canShare) {
        <button type="button" (click)="share()">{{ 'pro.keep.share' | t }}</button>
      }
    </div>
    <p class="small muted feedback" role="status" aria-live="polite">{{ feedback() | t }}</p>
  `,
  styles: `
    .keep-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .keep-actions > * {
      flex: 1 1 140px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      text-decoration: none;
    }
    .feedback {
      min-height: 1.4em;
      margin: 6px 0 0;
    }
  `,
})
export class KeepCodeComponent {
  private readonly i18n = inject(I18nService);
  readonly code = input.required<string>();
  readonly feedback = signal('');
  readonly canShare = canShareText();

  emailHref() {
    return emailToSelfHref(
      this.code(),
      this.i18n.t('pro.keep.emailSubject'),
      this.i18n.t('pro.keep.emailIntro'),
    );
  }

  async copy() {
    // Copy the full link: pasting it anywhere (or opening it) activates Pro.
    const copied = await copyText(activationLink(this.code()));
    this.feedback.set(copied ? 'pro.keep.copied' : 'pro.keep.copyFailed');
  }

  async share() {
    const shared = await shareActivationLink(this.code(), this.i18n.t('pro.keep.emailSubject'));
    this.feedback.set(shared ? 'pro.keep.shared' : '');
  }
}

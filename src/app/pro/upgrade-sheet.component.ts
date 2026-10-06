import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { EntitlementService, SHIPPED_PRO_FEATURES } from '../data/entitlement.service';
import { PRO_PRICE_LABEL } from '../data/license-config';
import { ModalDirective } from '../shared/modal.directive';
import { TranslatePipe } from '../i18n/translate.pipe';
import { CheckoutFailure, createCheckoutSession } from './checkout';
import { ProUpsellService } from './pro-upsell.service';
import { UnlockCodeFormComponent } from './unlock-code-form.component';

/**
 * The one place a coach upgrades. Bottom sheet on phones, dialog on larger screens.
 * Checkout itself happens on Stripe's hosted page; this sheet only explains and hands off.
 */
@Component({
  selector: 'app-upgrade-sheet',
  imports: [ModalDirective, TranslatePipe, UnlockCodeFormComponent],
  template: `
    @if (upsell.request(); as request) {
      <div
        class="sheet-backdrop upgrade-backdrop"
        tabindex="-1"
        (click)="backdropClick($event)"
        (keydown.escape)="upsell.close()"
      >
        <div
          appModal
          class="sheet upgrade-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-title"
        >
          @if (entitlement.isPro()) {
            <div class="sheet-header">
              <p class="eyebrow pro-eyebrow">✦ {{ 'pro.brand' | t }}</p>
              <button
                type="button"
                class="close"
                (click)="upsell.close()"
                [attr.aria-label]="'pro.close' | t"
              >
                ×
              </button>
            </div>
            <h2 id="upgrade-title">{{ 'pro.success.title' | t }}</h2>
            <p>{{ 'pro.success.body' | t }}</p>
            <button type="button" class="primary wide" (click)="upsell.close()">
              {{ 'pro.success.continue' | t }}
            </button>
          } @else {
            <div class="sheet-header">
              <p class="eyebrow pro-eyebrow">✦ {{ 'pro.brand' | t }}</p>
              <button
                type="button"
                class="close"
                (click)="upsell.close()"
                [attr.aria-label]="'pro.close' | t"
              >
                ×
              </button>
            </div>
            <h2 id="upgrade-title">{{ 'pro.sheet.title' | t }}</h2>
            <p class="lede">{{ 'pro.sheet.lede' | t }}</p>

            @if (request.feature) {
              <p class="unlocks">
                <span class="small eyebrow">{{ 'pro.sheet.unlocks' | t }}</span>
                <strong>{{ 'pro.feature.' + request.feature + '.name' | t }}</strong>
              </p>
            }

            <ul class="benefits">
              @for (feature of features; track feature) {
                <li [class.highlight]="feature === request.feature">
                  <span class="check" aria-hidden="true">✓</span>
                  <span>
                    <strong>{{ 'pro.feature.' + feature + '.name' | t }}</strong>
                    <span class="small muted">{{
                      'pro.feature.' + feature + '.description' | t
                    }}</span>
                  </span>
                </li>
              }
            </ul>
            <p class="small muted always-free">{{ 'pro.sheet.alwaysFree' | t }}</p>

            @if (price) {
              <p class="price">
                <strong>{{ price }}</strong> · {{ 'pro.sheet.oneTime' | t }}
              </p>
            }

            @if (!online()) {
              <p class="notice" role="status">{{ 'pro.checkout.offline' | t }}</p>
            }
            <button
              type="button"
              class="primary wide checkout"
              [disabled]="redirecting() || !online()"
              (click)="checkout()"
            >
              {{ (redirecting() ? 'pro.sheet.opening' : 'pro.sheet.checkout') | t }}
            </button>
            <p class="small muted secure">{{ 'pro.sheet.secure' | t }}</p>
            @if (failure()) {
              <p class="error small" role="alert">{{ 'pro.checkout.' + failure() | t }}</p>
            }

            <details class="have-code" [open]="failure() === 'not_open'">
              <summary>{{ 'pro.sheet.haveCode' | t }}</summary>
              <app-unlock-code-form />
            </details>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .upgrade-sheet {
      padding-bottom: calc(24px + env(safe-area-inset-bottom));
    }
    .sheet-header {
      margin-bottom: 4px;
    }
    .pro-eyebrow {
      color: var(--green);
      margin: 0;
    }
    .close {
      min-width: 44px;
      font-size: 24px;
      line-height: 1;
    }
    h2 {
      margin: 4px 0 6px;
      font-size: 26px;
    }
    .lede {
      margin: 0 0 14px;
    }
    .unlocks {
      display: grid;
      gap: 2px;
      margin: 0 0 12px;
      padding: 10px 12px;
      border-left: 4px solid var(--green);
      border-radius: 6px;
      background: #e6eee2;
    }
    .unlocks .eyebrow {
      margin: 0;
    }
    .benefits {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
    }
    .benefits li {
      display: grid;
      grid-template-columns: 22px 1fr;
      gap: 6px;
      align-items: start;
    }
    .benefits li > span:last-child {
      display: grid;
      gap: 2px;
    }
    .benefits li.highlight strong {
      color: var(--green);
    }
    .check {
      color: var(--green);
      font-weight: 800;
    }
    .always-free {
      margin: 14px 0 0;
    }
    .price {
      margin: 16px 0 0;
      font-size: 18px;
    }
    .wide {
      width: 100%;
      margin-top: 16px;
      min-height: 52px;
      font-size: 17px;
    }
    .secure {
      text-align: center;
      margin: 8px 0 0;
    }
    .have-code {
      margin-top: 18px;
      border-top: 1px solid var(--line);
      padding-top: 12px;
    }
    .have-code summary {
      min-height: 44px;
      display: flex;
      align-items: center;
      cursor: pointer;
      font-weight: 700;
    }
    @media (max-width: 600px) {
      .upgrade-backdrop {
        align-items: flex-end;
        padding: 0;
      }
      .upgrade-sheet {
        border-radius: 18px 18px 0 0;
        width: 100%;
        max-height: 92dvh;
        padding-left: calc(20px + env(safe-area-inset-left));
        padding-right: calc(20px + env(safe-area-inset-right));
      }
    }
  `,
})
export class UpgradeSheetComponent implements OnDestroy {
  readonly upsell = inject(ProUpsellService);
  readonly entitlement = inject(EntitlementService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly features = SHIPPED_PRO_FEATURES;
  readonly price = PRO_PRICE_LABEL;
  readonly online = signal(navigator.onLine);
  readonly redirecting = signal(false);
  readonly failure = signal<CheckoutFailure | null>(null);
  private readonly isOpen = computed(() => !!this.upsell.request());
  private readonly onConnectivity = () => this.online.set(navigator.onLine);

  constructor() {
    window.addEventListener('online', this.onConnectivity);
    window.addEventListener('offline', this.onConnectivity);
    // Fresh state every time the sheet opens, and when returning via the browser back button
    // from Stripe (bfcache restores the page with the "Opening…" state otherwise).
    effect(() => {
      if (this.isOpen()) {
        this.failure.set(null);
        this.redirecting.set(false);
      }
    });
    window.addEventListener('pageshow', this.onPageShow);
  }

  private readonly onPageShow = () => this.redirecting.set(false);

  /** Works even when focus has fallen to <body> (e.g. after a disabled button). */
  @HostListener('document:keydown.escape')
  escape() {
    if (this.isOpen()) this.upsell.close();
  }

  backdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) this.upsell.close();
  }

  async checkout() {
    if (this.redirecting()) return;
    this.failure.set(null);
    this.redirecting.set(true);
    const result = await createCheckoutSession(document.baseURI);
    if (result.ok) {
      window.location.assign(result.url);
      return;
    }
    this.redirecting.set(false);
    this.failure.set(result.reason);
    // The button was disabled while waiting, which drops focus; put it back for keyboard users.
    queueMicrotask(() =>
      this.host.nativeElement.querySelector<HTMLButtonElement>('button.checkout')?.focus(),
    );
  }

  ngOnDestroy() {
    window.removeEventListener('online', this.onConnectivity);
    window.removeEventListener('offline', this.onConnectivity);
    window.removeEventListener('pageshow', this.onPageShow);
  }
}

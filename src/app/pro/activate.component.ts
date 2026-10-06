import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EntitlementService } from '../data/entitlement.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ActivationFailure, requestUnlockCode } from './checkout';
import { KeepCodeComponent } from './keep-code.component';
import { isIosBrowserTab } from './license-sharing';
import { UnlockCodeFormComponent } from './unlock-code-form.component';

type ActivationState =
  | { kind: 'working' }
  | { kind: 'success' }
  | { kind: 'idle' }
  | { kind: 'purchase_error'; reason: ActivationFailure }
  | { kind: 'code_error'; reason: string };

/**
 * Landing page for Stripe's success redirect (`?session_id=`) and for activation links
 * (`#code=`). Turns either into Pro on this device, then helps the coach keep their code.
 */
@Component({
  selector: 'app-activate',
  imports: [RouterLink, TranslatePipe, KeepCodeComponent, UnlockCodeFormComponent],
  template: `
    <section class="page activate-page">
      @switch (state().kind) {
        @case ('working') {
          <div class="card center" role="status" aria-live="polite">
            <p class="mark spin" aria-hidden="true">✦</p>
            <h1>{{ 'pro.activate.working' | t }}</h1>
            <p class="muted">{{ 'pro.activate.workingHint' | t }}</p>
          </div>
        }
        @case ('success') {
          <div class="card center success" role="status" aria-live="polite">
            <p class="mark" aria-hidden="true">✦</p>
            <h1>{{ 'pro.activate.title' | t }}</h1>
            @if (licensee()) {
              <p class="licensee">{{ 'pro.licensedTo' | t: { name: licensee() } }}</p>
            }
            <p>{{ 'pro.activate.body' | t }}</p>
            <div class="row actions">
              <a routerLink="/reports" class="button primary">{{
                'pro.activate.openReports' | t
              }}</a>
              <a routerLink="/settings" class="button">{{ 'pro.activate.openSettings' | t }}</a>
            </div>
          </div>
          @if (code(); as code) {
            <div class="card keep">
              <h2>{{ 'pro.keep.title' | t }}</h2>
              <p class="muted">{{ 'pro.keep.body' | t }}</p>
              <app-keep-code [code]="code" />
              @if (iosTab) {
                <p class="notice small">{{ 'pro.activate.iosTip' | t }}</p>
              }
            </div>
          }
        }
        @case ('purchase_error') {
          <div class="card" role="alert">
            <h1>{{ 'pro.activate.problemTitle' | t }}</h1>
            <p>{{ 'pro.activation.' + purchaseReason() | t }}</p>
            @if (canRetry()) {
              <button type="button" class="primary" (click)="retry()">
                {{ 'pro.activate.retry' | t }}
              </button>
            }
          </div>
          <div class="card">
            <h2>{{ 'pro.sheet.haveCode' | t }}</h2>
            <app-unlock-code-form (activated)="onActivated()" />
          </div>
        }
        @default {
          <div class="card">
            <p class="eyebrow">✦ {{ 'pro.brand' | t }}</p>
            <h1>{{ 'pro.activate.pasteTitle' | t }}</h1>
            @if (codeError(); as reason) {
              <p class="error" role="alert">{{ 'pro.code.error.' + reason | t }}</p>
            }
            <app-unlock-code-form (activated)="onActivated()" />
          </div>
        }
      }
    </section>
  `,
  styles: `
    .activate-page {
      max-width: 640px;
      margin: 0 auto;
      display: grid;
      gap: 16px;
    }
    .center {
      text-align: center;
    }
    .mark {
      font-size: 44px;
      color: var(--green);
      margin: 0;
      line-height: 1;
    }
    .spin {
      animation: spin 1.6s linear infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .spin {
        animation: none;
      }
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    h1 {
      margin: 10px 0 6px;
    }
    h1:focus {
      outline: none;
    }
    h1:focus-visible {
      outline: var(--focus-ring, 3px solid var(--green));
    }
    .licensee {
      font-weight: 700;
      color: var(--green);
      margin: 0 0 8px;
    }
    .actions {
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }
    .keep h2 {
      margin-top: 0;
    }
  `,
})
export class ActivateComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly entitlement = inject(EntitlementService);
  readonly state = signal<ActivationState>({ kind: 'working' });
  readonly iosTab = isIosBrowserTab();
  readonly licensee = computed(() => this.entitlement.license().licenseeName ?? '');
  readonly code = computed(() => this.entitlement.license().code ?? null);
  private sessionId: string | null = null;

  readonly purchaseReason = computed(() => {
    const state = this.state();
    return state.kind === 'purchase_error' ? state.reason : '';
  });
  readonly codeError = computed(() => {
    const state = this.state();
    return state.kind === 'code_error' ? state.reason : '';
  });
  readonly canRetry = computed(() =>
    ['offline', 'not_paid', 'unavailable'].includes(this.purchaseReason()),
  );

  async ngOnInit() {
    const fragment = this.route.snapshot.fragment ?? '';
    const code =
      new URLSearchParams(fragment).get('code') ?? (fragment.startsWith('PH1.') ? fragment : null);
    this.sessionId = this.route.snapshot.queryParamMap.get('session_id');

    if (code) {
      await this.activateCode(code);
    } else if (this.sessionId) {
      await this.activatePurchase(this.sessionId);
    } else {
      this.state.set(
        this.entitlement.license().source === 'unlock_code'
          ? { kind: 'success' }
          : { kind: 'idle' },
      );
    }
  }

  async retry() {
    if (this.sessionId) await this.activatePurchase(this.sessionId);
  }

  onActivated() {
    this.succeed();
  }

  private async activatePurchase(sessionId: string) {
    this.state.set({ kind: 'working' });
    const response = await requestUnlockCode(sessionId);
    if (!response.ok) {
      this.state.set({ kind: 'purchase_error', reason: response.reason });
      return;
    }
    await this.activateCode(response.code);
  }

  private async activateCode(code: string) {
    this.state.set({ kind: 'working' });
    try {
      const result = await this.entitlement.activate(code);
      if (result.ok) this.succeed();
      else this.state.set({ kind: 'code_error', reason: result.reason });
    } catch {
      this.state.set({ kind: 'code_error', reason: 'storage' });
    }
  }

  private succeed() {
    // The URL is left as-is on purpose: it stays in browser history as a restore link, and
    // re-opening it re-activates the same code.
    this.state.set({ kind: 'success' });
  }
}

import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CoachTier, EntitlementService, SHIPPED_PRO_FEATURES } from '../data/entitlement.service';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { KeepCodeComponent } from './keep-code.component';
import { ProUpsellService } from './pro-upsell.service';
import { UnlockCodeFormComponent } from './unlock-code-form.component';

@Component({
  selector: 'app-pro-license-card',
  imports: [DatePipe, TranslatePipe, KeepCodeComponent, UnlockCodeFormComponent],
  template: `
    <section class="card license-card" aria-labelledby="pro-license-title">
      <p class="eyebrow">{{ 'pro.card.eyebrow' | t }}</p>
      <div class="license-heading">
        <h2 id="pro-license-title">{{ 'pro.brand' | t }}</h2>
        <span class="badge" [class.badge-pro]="entitlement.isPro()">
          {{ (entitlement.isPro() ? 'pro.card.badgePro' : 'pro.card.badgeFree') | t }}
        </span>
      </div>

      @if (checkoutCancelled()) {
        <p class="notice small" role="status">{{ 'pro.card.cancelled' | t }}</p>
      }

      @if (license().source === 'unlock_code') {
        <p class="licensee">
          {{
            license().licenseeName
              ? ('pro.licensedTo' | t: { name: license().licenseeName! })
              : ('pro.card.lifetime' | t)
          }}
        </p>
        <p class="small muted">
          {{
            'pro.card.activatedOn' | t: { date: (license().activatedAt | date: 'mediumDate') ?? '' }
          }}
          {{ 'pro.card.lifetimeNote' | t }}
        </p>
        <h3>{{ 'pro.keep.title' | t }}</h3>
        <p class="small muted">{{ 'pro.keep.body' | t }}</p>
        <app-keep-code [code]="license().code!" />
        <button type="button" class="text-button danger remove" (click)="remove()">
          {{ 'pro.card.remove' | t }}
        </button>
      } @else {
        <p class="muted">{{ 'pro.card.freeLede' | t }}</p>
        <ul class="feature-bullets">
          <li>
            {{ 'pro.card.freeCapture' | t }} <strong>{{ 'pro.card.alwaysFree' | t }}</strong>
          </li>
          <li>
            {{ 'pro.card.freeBackups' | t }} <strong>{{ 'pro.card.alwaysFree' | t }}</strong>
          </li>
          @for (feature of features; track feature) {
            <li>
              {{ 'pro.feature.' + feature + '.name' | t }}
              <strong>{{
                (entitlement.canAccess(feature) ? 'pro.card.unlocked' : 'pro.card.proOnly') | t
              }}</strong>
            </li>
          }
        </ul>
        <button type="button" class="primary unlock" (click)="upsell.open()">
          ✦ {{ 'pro.card.unlock' | t }}
        </button>
        <details class="have-code">
          <summary>{{ 'pro.sheet.haveCode' | t }}</summary>
          <app-unlock-code-form />
        </details>
      }

      @if (entitlement.simulatorAvailable) {
        <fieldset class="simulator">
          <legend>Developer preview (dev builds only)</legend>
          @for (option of simulatorOptions; track option.value) {
            <label class="check-label">
              <input
                type="radio"
                name="simulatedTier"
                [checked]="simulated() === option.value"
                (change)="entitlement.setSimulatedTier(option.value)"
              />
              {{ option.label }}
            </label>
          }
        </fieldset>
      }
    </section>
  `,
  styles: `
    .license-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .license-heading h2 {
      margin: 0;
    }
    .badge-pro {
      background: var(--green);
      color: #fff;
    }
    .licensee {
      font-size: 18px;
      font-weight: 750;
      color: var(--green);
      margin: 12px 0 2px;
    }
    h3 {
      margin: 18px 0 2px;
      font-size: 16px;
    }
    .feature-bullets {
      list-style: none;
      padding: 0;
      display: grid;
      gap: 6px;
    }
    .feature-bullets li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--line);
    }
    .feature-bullets strong {
      flex: none;
      white-space: nowrap;
    }
    .unlock {
      width: 100%;
      min-height: 50px;
    }
    .have-code {
      margin-top: 12px;
    }
    .have-code summary {
      min-height: 44px;
      display: flex;
      align-items: center;
      cursor: pointer;
      font-weight: 700;
    }
    .remove {
      margin-top: 12px;
      color: #a62c21;
    }
    .simulator {
      margin-top: 16px;
      border: 1px dashed var(--line);
      border-radius: 9px;
      display: grid;
      gap: 4px;
    }
  `,
})
export class ProLicenseCardComponent {
  readonly entitlement = inject(EntitlementService);
  readonly upsell = inject(ProUpsellService);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  readonly features = SHIPPED_PRO_FEATURES;
  readonly license = this.entitlement.license;
  readonly checkoutCancelled = signal(
    this.route.snapshot.queryParamMap.get('checkout') === 'cancelled',
  );
  readonly simulated = computed(() =>
    this.entitlement.status().source === 'simulated' ? this.entitlement.tier() : null,
  );
  readonly simulatorOptions: { value: CoachTier | null; label: string }[] = [
    { value: null, label: 'Real license on this device' },
    { value: 'free', label: 'Simulate Free Coach' },
    { value: 'pro', label: 'Simulate Pro Coach' },
  ];

  async remove() {
    if (!confirm(this.i18n.t('pro.card.removeConfirm'))) return;
    await this.entitlement.deactivate();
  }
}

import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CoachStore } from '../data/coach-store';
import { EntitlementService } from '../data/entitlement.service';
import { STANDARD_FENCE_PRESETS } from '../data/models';
import { groupMetrics, ratePercent, rollingRates, trendChange } from '../data/pro-analytics';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { FieldComponent } from '../shared/field.component';
import { DEMO_EVENTS, DEMO_PLAYERS } from '../pro/demo-data';
import { ProUpsellService } from '../pro/pro-upsell.service';

/**
 * Pro: a one-page, print-ready player scout card. "Save as PDF" is the browser's own print
 * dialog, so nothing leaves the device.
 */
@Component({
  selector: 'app-scout-card',
  imports: [DatePipe, RouterLink, FieldComponent, TranslatePipe],
  template: `
    <div class="scout-page">
      <div class="scout-toolbar no-print">
        <a class="button" routerLink="/reports" [queryParams]="{ player: playerId() }">{{
          'scout.back' | t
        }}</a>
        @if (unlocked()) {
          <button type="button" class="primary" (click)="print()" [disabled]="!player()">
            {{ 'scout.print' | t }}
          </button>
        } @else {
          <button type="button" class="primary" (click)="upsell.open('scout_pdf_export')">
            {{ 'proa.unlock' | t }}
          </button>
        }
      </div>
      @if (!unlocked()) {
        <p class="notice no-print">
          <strong>{{ 'scout.sampleTitle' | t }}</strong> {{ 'scout.sampleBody' | t }}
        </p>
      }

      @if (player(); as p) {
        <article class="scout-card" [attr.aria-label]="'scout.cardLabel' | t">
          <header class="scout-header">
            @if (team()?.logoUrl) {
              <img class="crest" [src]="team()!.logoUrl" alt="" width="64" height="64" />
            } @else {
              <span class="crest monogram" aria-hidden="true">{{ monogram() }}</span>
            }
            <div class="team">
              <p class="eyebrow">
                {{ 'scout.eyebrow' | t: { team: team()?.name || ('scout.sampleTeam' | t) } }}
              </p>
              <h1>
                {{ p.name }}
                @if (p.jerseyNumber) {
                  <span class="jersey">#{{ p.jerseyNumber }}</span>
                }
              </h1>
              <p class="bio">
                {{ 'scout.bio' | t: { bats: p.bats, throws: p.throws } }}
                @if (p.positions.length) {
                  · {{ p.positions.join(', ') }}
                }
                @if (p.grade) {
                  · {{ 'scout.grade' | t: { grade: p.grade } }}
                }
              </p>
            </div>
            <p class="generated">{{ today | date: 'mediumDate' }}</p>
          </header>

          <div class="scout-body">
            <figure class="spray">
              <app-field
                [events]="events()"
                colorBy="hardHit"
                [palette]="palette()"
                [shapeMarkers]="true"
                [fenceConfig]="fence"
                [label]="'scout.sprayLabel' | t: { name: p.name }"
              />
              <figcaption>{{ 'scout.sprayCaption' | t }}</figcaption>
            </figure>

            <div class="numbers">
              <dl class="metric-grid">
                <div>
                  <dt>{{ 'proa.m.contacts' | t }}</dt>
                  <dd>{{ metrics().total }}</dd>
                  <small>{{
                    (practiceCount() === 1 ? 'scout.practice' : 'scout.practices')
                      | t: { n: practiceCount() }
                  }}</small>
                </div>
                <div>
                  <dt>{{ 'proa.trend.hardHit' | t }}</dt>
                  <dd>{{ pct(metrics().hardHit) }}</dd>
                  <small>{{
                    'scout.rated'
                      | t: { count: metrics().hardHit.count, total: metrics().hardHit.of }
                  }}</small>
                </div>
                <div>
                  <dt>{{ 'proa.trend.whiff' | t }}</dt>
                  <dd>{{ pct(metrics().whiff) }}</dd>
                  <small>{{
                    'scout.rated' | t: { count: metrics().whiff.count, total: metrics().whiff.of }
                  }}</small>
                </div>
                <div>
                  <dt>{{ 'proa.m.lineDrive' | t }}</dt>
                  <dd>{{ pct(metrics().lineDrive) }}</dd>
                  <small>{{
                    'scout.typed'
                      | t: { count: metrics().lineDrive.count, total: metrics().lineDrive.of }
                  }}</small>
                </div>
                <div>
                  <dt>{{ 'scout.avgDistance' | t }}</dt>
                  <dd>
                    {{
                      metrics().averageDistanceFeet === null
                        ? '—'
                        : metrics().averageDistanceFeet + ' ft'
                    }}
                  </dd>
                  <small>{{ 'scout.ballsInPlay' | t: { n: metrics().ballsInPlay } }}</small>
                </div>
                <div>
                  <dt>{{ 'scout.trend' | t }}</dt>
                  <dd>{{ change() }}</dd>
                  <small>{{ 'scout.trendHint' | t }}</small>
                </div>
              </dl>

              <div class="direction" [attr.aria-label]="'scout.directionLabel' | t">
                <p class="eyebrow">{{ 'scout.direction' | t }}</p>
                @for (d of directions(); track d.label) {
                  <div class="bar-row">
                    <span>{{ d.label }}</span>
                    <span class="bar"
                      ><span class="fill" [style.width.%]="d.percent ?? 0"></span
                    ></span>
                    <b>{{ d.percent === null ? '—' : d.percent + '%' }}</b>
                  </div>
                }
                <small>{{ 'scout.directionNote' | t: { n: metrics().pull.of } }}</small>
              </div>

              @if (coachNotes().length) {
                <div class="notes">
                  <p class="eyebrow">{{ 'scout.notes' | t }}</p>
                  @for (note of coachNotes(); track $index) {
                    <p>{{ note }}</p>
                  }
                </div>
              }
            </div>
          </div>

          <footer class="scout-footer">{{ 'scout.footer' | t: { range: range() } }}</footer>
        </article>
      } @else {
        <p class="empty">{{ 'scout.missing' | t }}</p>
      }
    </div>
  `,
  styles: `
    .scout-page {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px 16px 120px;
      display: grid;
      gap: 14px;
    }
    .scout-toolbar {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .scout-toolbar .button {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
      padding: 0 14px;
    }
    .scout-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 22px;
      display: grid;
      gap: 18px;
    }
    .scout-header {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 14px;
      align-items: center;
      border-bottom: 3px solid var(--green);
      padding-bottom: 14px;
    }
    .crest {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      object-fit: contain;
    }
    .monogram {
      display: grid;
      place-items: center;
      background: var(--green);
      color: #fff;
      font-weight: 800;
      font-size: 22px;
    }
    .eyebrow {
      margin: 0 0 2px;
    }
    h1 {
      margin: 0;
      font-size: 28px;
    }
    .jersey {
      color: var(--muted);
      font-weight: 600;
    }
    .bio,
    .generated {
      margin: 2px 0 0;
      color: var(--muted);
      font-size: 14px;
    }
    .generated {
      align-self: start;
    }
    .scout-body {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      gap: 20px;
      align-items: start;
    }
    .spray {
      margin: 0;
    }
    figcaption,
    small {
      color: var(--muted);
      font-size: 12px;
    }
    .numbers {
      display: grid;
      gap: 16px;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin: 0;
    }
    .metric-grid div {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
    }
    dt {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
    }
    dd {
      margin: 2px 0;
      font-size: 24px;
      font-weight: 800;
    }
    .bar-row {
      display: grid;
      grid-template-columns: 64px 1fr 44px;
      align-items: center;
      gap: 8px;
      margin: 6px 0;
      font-size: 14px;
    }
    .bar {
      height: 10px;
      border-radius: 5px;
      background: var(--cream);
      overflow: hidden;
    }
    .fill {
      display: block;
      height: 100%;
      background: var(--green);
    }
    .notes p {
      margin: 4px 0;
      font-size: 14px;
      white-space: pre-line;
    }
    .scout-footer {
      border-top: 1px solid var(--line);
      padding-top: 10px;
      color: var(--muted);
      font-size: 12px;
    }
    @media (max-width: 700px) {
      .scout-body {
        grid-template-columns: 1fr;
      }
      .scout-header {
        grid-template-columns: auto 1fr;
      }
      .generated {
        display: none;
      }
    }
    @media print {
      @page {
        size: letter portrait;
        margin: 0.5in;
      }
      .scout-page {
        padding: 0;
        max-width: none;
      }
      .scout-card {
        border: 0;
        padding: 0;
        break-inside: avoid;
      }
      .scout-body {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class ScoutCardComponent {
  private readonly store = inject(CoachStore);
  private readonly entitlement = inject(EntitlementService);
  readonly upsell = inject(ProUpsellService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);
  readonly today = new Date();
  readonly fence = STANDARD_FENCE_PRESETS.high_school;

  readonly routePlayerId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('playerId') ?? '')),
    { initialValue: '' },
  );
  readonly unlocked = computed(() => this.entitlement.canAccess('scout_pdf_export'));
  readonly playerId = computed(() => this.routePlayerId());
  readonly player = computed(() =>
    this.unlocked()
      ? this.store.players().find((p) => p.id === this.playerId())
      : DEMO_PLAYERS.find((p) => p.id === 'demo-b'),
  );
  readonly team = computed(() =>
    this.unlocked() ? this.store.teams().find((t) => t.id === this.player()?.teamId) : undefined,
  );
  readonly events = computed(() => {
    const id = this.player()?.id;
    const source = this.unlocked() ? this.store.events() : DEMO_EVENTS;
    return source.filter((e) => e.playerId === id);
  });
  readonly palette = computed(() => this.store.settings().colorPalette || 'standard');
  readonly metrics = computed(() => groupMetrics(this.events()));
  readonly practiceCount = computed(() => new Set(this.events().map((e) => e.sessionId)).size);
  readonly change = computed(() => {
    const value = trendChange(rollingRates(this.events(), 30), 'hardHit');
    return value === null ? '—' : this.i18n.t('proa.pts', { n: `${value > 0 ? '+' : ''}${value}` });
  });
  readonly directions = computed(() => {
    const m = this.metrics();
    return [
      { label: this.i18n.t('proa.m.pull'), percent: ratePercent(m.pull) },
      { label: this.i18n.t('proa.m.center'), percent: ratePercent(m.center) },
      { label: this.i18n.t('scout.oppo'), percent: ratePercent(m.opposite) },
    ];
  });
  readonly coachNotes = computed(() => {
    const player = this.player();
    if (!player || !this.unlocked()) return [];
    const notes = this.store
      .notes()
      .filter((n) => n.playerId === player.id && !n.eventId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 3)
      .map((n) => n.text);
    return [player.notes, ...notes].filter((text) => text.trim());
  });
  readonly range = computed(() => {
    const stamps = this.events()
      .map((e) => e.timestamp.slice(0, 10))
      .sort();
    if (!stamps.length) return this.i18n.t('scout.noPractices');
    return stamps[0] === stamps[stamps.length - 1]
      ? stamps[0]
      : this.i18n.t('scout.dateRange', { from: stamps[0], to: stamps[stamps.length - 1] });
  });
  readonly monogram = computed(() => {
    const name = this.team()?.shortName || this.team()?.name || 'PH';
    return name.slice(0, 3).toUpperCase();
  });

  pct(value: { count: number; of: number }): string {
    const pct = ratePercent(value);
    return pct === null ? '—' : `${pct}%`;
  }

  print() {
    window.print();
  }
}

import { Component, computed, inject, input, signal } from '@angular/core';
import {
  ALIGNMENT_IDS,
  AlignmentCoverage,
  AlignmentId,
  alignmentCoverage,
  alignmentZones,
  dominantSide,
} from '../data/defense';
import { EntitlementService, FeatureId } from '../data/entitlement.service';
import {
  BallEvent,
  ColorPaletteMode,
  FieldThemeMode,
  OutfieldFenceConfig,
  Player,
  STANDARD_FENCE_PRESETS,
} from '../data/models';
import {
  GroupMetrics,
  Ratio,
  groupMetrics,
  ratePercent,
  rollingRates,
  trendChange,
  TrendPoint,
} from '../data/pro-analytics';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { FieldComponent, SERIES_COLORS } from '../shared/field.component';
import { DEMO_EVENTS, DEMO_PLAYERS } from '../pro/demo-data';
import { ProUpsellService } from '../pro/pro-upsell.service';

type Tab = 'compare' | 'trends' | 'defense';
type CompareMode = 'players' | 'split';
type CoverageKey = keyof AlignmentCoverage;

interface MetricCell {
  main: string;
  /** Explicit denominator, e.g. "41 of 90". */
  detail: string;
}

interface MetricRow {
  label: string;
  a: MetricCell;
  b: MetricCell;
}

const CHART = { width: 480, height: 250, left: 48, right: 14, top: 14, bottom: 38 };

const TAB_FEATURES: Record<Tab, FeatureId> = {
  compare: 'multi_player_comparison',
  trends: 'advanced_time_series',
  defense: 'defensive_alignment',
};

/** Sample hitter used by each tab's free preview. */
const DEMO_FOCUS: Record<Tab, string> = { compare: '', trends: 'demo-b', defense: 'demo-a' };

/**
 * Pro analysis on the Reports page: compare hitters, rolling development trends, and defensive
 * alignment coverage. Free coaches see the same tools running on sample data.
 */
@Component({
  selector: 'app-pro-analytics',
  imports: [FieldComponent, TranslatePipe],
  templateUrl: './pro-analytics.component.html',
  styleUrl: './pro-analytics.component.scss',
})
export class ProAnalyticsComponent {
  private readonly entitlement = inject(EntitlementService);
  private readonly upsell = inject(ProUpsellService);
  private readonly i18n = inject(I18nService);

  /** Team observations after the report's filters, across every hitter. */
  readonly events = input<BallEvent[]>([]);
  readonly players = input<Player[]>([]);
  /** Hitter selected in the report filters, if any. */
  readonly focusPlayerId = input('');
  readonly palette = input<ColorPaletteMode>('standard');
  readonly theme = input<FieldThemeMode>('classic');
  readonly fenceConfig = input<OutfieldFenceConfig | null>(null);

  readonly seriesColors = SERIES_COLORS;
  readonly tabs: readonly Tab[] = ['compare', 'trends', 'defense'];
  readonly tab = signal<Tab>('compare');
  readonly mode = signal<CompareMode>('players');
  readonly pickA = signal('');
  readonly pickB = signal('');
  readonly pickSplit = signal('');
  readonly windowDays = signal(30);
  readonly windows = [14, 30, 60];
  readonly alignment = signal<AlignmentId>('standard');
  readonly alignmentIds = ALIGNMENT_IDS;
  readonly coverageKeys: readonly CoverageKey[] = ['ground', 'line', 'fly'];

  readonly feature = computed<FeatureId>(() => TAB_FEATURES[this.tab()]);
  readonly unlocked = computed(() => this.entitlement.canAccess(this.feature()));
  readonly sourceEvents = computed<readonly BallEvent[]>(() =>
    this.unlocked() ? this.events() : DEMO_EVENTS,
  );
  readonly sourcePlayers = computed<readonly Player[]>(() =>
    this.unlocked() ? this.players() : DEMO_PLAYERS,
  );
  private readonly fence = computed(() => this.fenceConfig() ?? STANDARD_FENCE_PRESETS.high_school);

  /** Hitters with at least one observation in scope, most active first. */
  readonly activePlayers = computed(() => {
    const counts = new Map<string, number>();
    for (const event of this.sourceEvents())
      counts.set(event.playerId, (counts.get(event.playerId) ?? 0) + 1);
    return this.sourcePlayers()
      .filter((p) => counts.has(p.id))
      .map((player) => ({ player, count: counts.get(player.id)! }))
      .sort((a, b) => b.count - a.count || a.player.order - b.player.order);
  });

  readonly playerA = computed(() => {
    const ids = this.activePlayers().map((p) => p.player.id);
    if (this.unlocked()) {
      if (ids.includes(this.pickA())) return this.pickA();
      if (ids.includes(this.focusPlayerId())) return this.focusPlayerId();
    }
    return ids[0] ?? '';
  });
  readonly playerB = computed(() => {
    const ids = this.activePlayers()
      .map((p) => p.player.id)
      .filter((id) => id !== this.playerA());
    if (this.unlocked() && ids.includes(this.pickB())) return this.pickB();
    return ids[0] ?? '';
  });

  /** Hitters who have recorded contacts from both sides of the plate. */
  readonly switchHitters = computed(() => {
    const sides = new Map<string, Set<string>>();
    for (const event of this.sourceEvents()) {
      if (!event.batterSide) continue;
      const set = sides.get(event.playerId) ?? new Set<string>();
      set.add(event.batterSide);
      sides.set(event.playerId, set);
    }
    return this.sourcePlayers().filter((p) => (sides.get(p.id)?.size ?? 0) === 2);
  });
  readonly splitPlayer = computed(() => {
    const ids = this.switchHitters().map((p) => p.id);
    if (this.unlocked()) {
      if (ids.includes(this.pickSplit())) return this.pickSplit();
      if (ids.includes(this.focusPlayerId())) return this.focusPlayerId();
    }
    return ids[0] ?? '';
  });

  readonly groups = computed(() => {
    const events = this.sourceEvents();
    if (this.mode() === 'split') {
      const id = this.splitPlayer();
      const own = events.filter((e) => e.playerId === id);
      return {
        a: own.filter((e) => e.batterSide === 'L'),
        b: own.filter((e) => e.batterSide === 'R'),
        labelA: this.i18n.t('proa.battingLeft'),
        labelB: this.i18n.t('proa.battingRight'),
      };
    }
    return {
      a: events.filter((e) => e.playerId === this.playerA()),
      b: events.filter((e) => e.playerId === this.playerB()),
      labelA: this.nameOf(this.playerA()),
      labelB: this.nameOf(this.playerB()),
    };
  });
  readonly overlay = computed(() => [...this.groups().a, ...this.groups().b]);
  readonly series = computed(() => {
    const map = new Map<string, 'a' | 'b'>();
    for (const event of this.groups().a) map.set(event.id, 'a');
    for (const event of this.groups().b) map.set(event.id, 'b');
    return map;
  });
  readonly canCompare = computed(() => this.groups().a.length > 0 && this.groups().b.length > 0);
  readonly metricRows = computed<MetricRow[]>(() => {
    const a = groupMetrics(this.groups().a);
    const b = groupMetrics(this.groups().b);
    const rate = (key: keyof GroupMetrics) => ({
      a: this.ratioCell(a[key] as Ratio),
      b: this.ratioCell(b[key] as Ratio),
    });
    return [
      {
        label: this.i18n.t('proa.m.contacts'),
        a: { main: String(a.total), detail: '' },
        b: { main: String(b.total), detail: '' },
      },
      { label: this.i18n.t('proa.m.hardHit'), ...rate('hardHit') },
      { label: this.i18n.t('proa.m.whiff'), ...rate('whiff') },
      { label: this.i18n.t('proa.m.lineDrive'), ...rate('lineDrive') },
      { label: this.i18n.t('proa.m.pull'), ...rate('pull') },
      { label: this.i18n.t('proa.m.center'), ...rate('center') },
      { label: this.i18n.t('proa.m.opposite'), ...rate('opposite') },
      {
        label: this.i18n.t('proa.m.distance'),
        a: this.distanceCell(a),
        b: this.distanceCell(b),
      },
    ];
  });

  /** Hitter the Trends and Defense tabs focus on: the report's hitter, or a sample one. */
  readonly scopePlayerId = computed(() =>
    this.unlocked() ? this.focusPlayerId() : DEMO_FOCUS[this.tab()],
  );
  readonly scopeLabel = computed(() =>
    this.scopePlayerId() ? this.nameOf(this.scopePlayerId()) : this.i18n.t('proa.wholeTeam'),
  );
  private readonly scopeEvents = computed(() => {
    const id = this.scopePlayerId();
    return id ? this.sourceEvents().filter((e) => e.playerId === id) : this.sourceEvents();
  });

  readonly trendPoints = computed<TrendPoint[]>(() =>
    rollingRates(this.scopeEvents(), this.windowDays()),
  );
  readonly hardHitChange = computed(() => trendChange(this.trendPoints(), 'hardHit'));
  readonly whiffChange = computed(() => trendChange(this.trendPoints(), 'whiff'));
  readonly chart = computed(() => this.buildChart(this.trendPoints()));

  readonly defenseEvents = computed(() => [...this.scopeEvents()]);
  readonly defenseSide = computed(() => dominantSide(this.scopeEvents()));
  readonly zones = computed(() =>
    alignmentZones(this.alignment(), this.defenseSide(), this.fence()),
  );
  readonly coverageRows = computed(() =>
    this.alignmentIds.map((id) => ({
      id,
      coverage: alignmentCoverage(this.scopeEvents(), id, this.fence()),
    })),
  );
  readonly hasCoverageData = computed(() =>
    this.coverageRows().some((row) => this.coverageKeys.some((key) => row.coverage[key].of > 0)),
  );
  /** Best alignment per column (first wins ties), or null when the column has no contacts. */
  readonly bestByColumn = computed(() => {
    const best = {} as Record<CoverageKey, AlignmentId | null>;
    for (const key of this.coverageKeys) {
      let winner: AlignmentId | null = null;
      let top = -1;
      for (const row of this.coverageRows()) {
        const pct = ratePercent(row.coverage[key]);
        if (pct !== null && pct > top) {
          top = pct;
          winner = row.id;
        }
      }
      best[key] = winner;
    }
    return best;
  });
  readonly defenseInsight = computed(() => {
    const rows = this.coverageRows();
    const standard = rows.find((r) => r.id === 'standard')!.coverage.ground;
    const bestId = this.bestByColumn().ground;
    if (!bestId || !standard.of) return '';
    const best = rows.find((r) => r.id === bestId)!.coverage.ground;
    if (bestId === 'standard' || best.count === standard.count) {
      return this.i18n.t('proa.def.insightStandard', {
        count: standard.count,
        total: standard.of,
        pct: ratePercent(standard) ?? 0,
      });
    }
    return this.i18n.t('proa.def.insight', {
      alignment: this.i18n.t(`proa.align.${bestId}`),
      count: best.count,
      total: best.of,
      pct: ratePercent(best) ?? 0,
      base: standard.count,
    });
  });

  setTab(tab: Tab) {
    this.tab.set(tab);
  }

  unlock() {
    this.upsell.open(this.feature());
  }

  nameOf(id: string): string {
    const player = this.sourcePlayers().find((p) => p.id === id);
    return player ? player.name : '';
  }

  ratioCell(value: Ratio): MetricCell {
    const pct = ratePercent(value);
    return pct === null
      ? { main: '—', detail: this.i18n.t('proa.noneRated') }
      : {
          main: `${pct}%`,
          detail: this.i18n.t('proa.of', { count: value.count, total: value.of }),
        };
  }

  /** Coverage cells: the denominator is recorded contacts of that type, not rated ones. */
  coverageCell(value: Ratio): MetricCell {
    return value.of ? this.ratioCell(value) : { main: '—', detail: this.i18n.t('proa.def.none') };
  }

  formatChange(change: number | null): string {
    if (change === null) return '—';
    return this.i18n.t('proa.pts', { n: `${change > 0 ? '+' : ''}${change}` });
  }

  trendAria(): string {
    return this.i18n.t('proa.trend.aria', {
      days: this.windowDays(),
      hard: this.formatChange(this.hardHitChange()),
      whiff: this.formatChange(this.whiffChange()),
      n: this.trendPoints().length,
    });
  }

  pointTitle(kind: 'tipHard' | 'tipWhiff', date: string, value: Ratio): string {
    return this.i18n.t(`proa.trend.${kind}`, { date, value: this.ratioLabel(value) });
  }

  ratioLabel(value: Ratio): string {
    const pct = ratePercent(value);
    return pct === null
      ? this.i18n.t('proa.noRated')
      : `${pct}% (${this.i18n.t('proa.of', { count: value.count, total: value.of })})`;
  }

  private distanceCell(metrics: GroupMetrics): MetricCell {
    return metrics.averageDistanceFeet === null
      ? { main: '—', detail: this.i18n.t('proa.noBallsInPlay') }
      : {
          main: `${metrics.averageDistanceFeet} ft`,
          detail: this.i18n.t('proa.inPlay', { n: metrics.ballsInPlay }),
        };
  }

  private buildChart(points: readonly TrendPoint[]) {
    const { width, height, left, right, top, bottom } = CHART;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const days = points.map((p) => Date.parse(`${p.date}T00:00:00Z`));
    const first = days[0] ?? 0;
    const span = Math.max(1, (days[days.length - 1] ?? 0) - first);
    const x = (i: number) =>
      points.length === 1 ? left + plotWidth / 2 : left + ((days[i] - first) / span) * plotWidth;
    const y = (pct: number) => top + plotHeight - (pct / 100) * plotHeight;
    const line = (metric: 'hardHit' | 'whiff') =>
      points
        .map((p, i) => ({ p, i, pct: ratePercent(p[metric]) }))
        .filter((d) => d.pct !== null)
        .map((d) => ({ x: x(d.i), y: y(d.pct!), point: d.p, pct: d.pct! }));
    const hard = line('hardHit');
    const whiff = line('whiff');
    const ticks = points.length
      ? [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].map((i) => ({
          x: x(i),
          label: this.shortDate(points[i].date),
        }))
      : [];
    return {
      width,
      height,
      left,
      right: width - right,
      bottom: top + plotHeight,
      grid: [0, 25, 50, 75, 100].map((pct) => ({ y: y(pct), label: `${pct}%` })),
      ticks,
      hard,
      whiff,
      hardPath: hard.map((d) => `${d.x},${d.y}`).join(' '),
      whiffPath: whiff.map((d) => `${d.x},${d.y}`).join(' '),
    };
  }

  private shortDate(date: string): string {
    const [, m, d] = date.split('-').map(Number);
    return this.i18n.currentLang() === 'es' ? `${d}/${m}` : `${m}/${d}`;
  }
}

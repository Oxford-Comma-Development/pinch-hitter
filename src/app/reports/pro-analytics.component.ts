import { Component, computed, inject, input, signal } from '@angular/core';
import { EntitlementService, FeatureId } from '../data/entitlement.service';
import {
  BallEvent,
  ColorPaletteMode,
  FieldThemeMode,
  OutfieldFenceConfig,
  Player,
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
import { FieldComponent, SERIES_COLORS } from '../shared/field.component';
import { DEMO_EVENTS, DEMO_PLAYERS } from '../pro/demo-data';
import { ProUpsellService } from '../pro/pro-upsell.service';

type Tab = 'compare' | 'trends';
type CompareMode = 'players' | 'split';

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

/**
 * Pro analysis on the Reports page: compare two hitters (or a switch-hitter's two sides) and
 * rolling development trends. Free coaches see the same tools running on sample data.
 */
@Component({
  selector: 'app-pro-analytics',
  imports: [FieldComponent],
  templateUrl: './pro-analytics.component.html',
  styleUrl: './pro-analytics.component.scss',
})
export class ProAnalyticsComponent {
  private readonly entitlement = inject(EntitlementService);
  private readonly upsell = inject(ProUpsellService);

  /** Team observations after the report's filters, across every hitter. */
  readonly events = input<BallEvent[]>([]);
  readonly players = input<Player[]>([]);
  /** Hitter selected in the report filters, if any. */
  readonly focusPlayerId = input('');
  readonly palette = input<ColorPaletteMode>('standard');
  readonly theme = input<FieldThemeMode>('classic');
  readonly fenceConfig = input<OutfieldFenceConfig | null>(null);

  readonly seriesColors = SERIES_COLORS;
  readonly tab = signal<Tab>('compare');
  readonly mode = signal<CompareMode>('players');
  readonly pickA = signal('');
  readonly pickB = signal('');
  readonly pickSplit = signal('');
  readonly windowDays = signal(30);
  readonly windows = [14, 30, 60];

  readonly feature = computed<FeatureId>(() =>
    this.tab() === 'compare' ? 'multi_player_comparison' : 'advanced_time_series',
  );
  readonly unlocked = computed(() => this.entitlement.canAccess(this.feature()));
  readonly sourceEvents = computed<readonly BallEvent[]>(() =>
    this.unlocked() ? this.events() : DEMO_EVENTS,
  );
  readonly sourcePlayers = computed<readonly Player[]>(() =>
    this.unlocked() ? this.players() : DEMO_PLAYERS,
  );

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
        labelA: 'Batting left',
        labelB: 'Batting right',
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
        label: 'Recorded contacts',
        a: { main: String(a.total), detail: '' },
        b: { main: String(b.total), detail: '' },
      },
      { label: 'Hard-hit rate (4–6)', ...rate('hardHit') },
      { label: 'Whiff rate', ...rate('whiff') },
      { label: 'Line drives', ...rate('lineDrive') },
      { label: 'Pull', ...rate('pull') },
      { label: 'Center', ...rate('center') },
      { label: 'Opposite field', ...rate('opposite') },
      {
        label: 'Average distance',
        a: this.distanceCell(a),
        b: this.distanceCell(b),
      },
    ];
  });

  readonly trendPlayerId = computed(() => (this.unlocked() ? this.focusPlayerId() : 'demo-b'));
  readonly trendScope = computed(() =>
    this.trendPlayerId() ? this.nameOf(this.trendPlayerId()) : 'Whole team',
  );
  readonly trendPoints = computed<TrendPoint[]>(() => {
    const id = this.trendPlayerId();
    const events = id ? this.sourceEvents().filter((e) => e.playerId === id) : this.sourceEvents();
    return rollingRates(events, this.windowDays());
  });
  readonly hardHitChange = computed(() => trendChange(this.trendPoints(), 'hardHit'));
  readonly whiffChange = computed(() => trendChange(this.trendPoints(), 'whiff'));
  readonly chart = computed(() => this.buildChart(this.trendPoints()));

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
      ? { main: '—', detail: 'none rated' }
      : { main: `${pct}%`, detail: `${value.count} of ${value.of}` };
  }

  formatChange(change: number | null): string {
    if (change === null) return '—';
    return `${change > 0 ? '+' : ''}${change} pts`;
  }

  ratioLabel(value: Ratio): string {
    const pct = ratePercent(value);
    return pct === null ? 'no rated contacts' : `${pct}% (${value.count} of ${value.of})`;
  }

  private distanceCell(metrics: GroupMetrics): MetricCell {
    return metrics.averageDistanceFeet === null
      ? { main: '—', detail: 'no balls in play' }
      : { main: `${metrics.averageDistanceFeet} ft`, detail: `${metrics.ballsInPlay} in play` };
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
    return `${m}/${d}`;
  }
}

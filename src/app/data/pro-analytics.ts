import { calculateDistanceFeet, directionFor, isOverTheFence, isWarningTrack } from './domain';
import { BallEvent, OutfieldFenceConfig } from './models';

/**
 * Pro analytics (Phase B). Pure functions over raw observations. Every rate carries its explicit
 * denominator, and stored coordinates are only read, never rounded or rewritten.
 */

export interface Ratio {
  count: number;
  of: number;
}

export interface GroupMetrics {
  total: number;
  /** Ratings 4–6 among contacts with a hard-hit rating. */
  hardHit: Ratio;
  /** Rating 0 (swing and miss) among contacts with a hard-hit rating. */
  whiff: Ratio;
  pull: Ratio;
  center: Ratio;
  opposite: Ratio;
  /** Line drives among contacts with a contact type. */
  lineDrive: Ratio;
  /** Mean estimated distance of balls in play, or null when there are none. */
  averageDistanceFeet: number | null;
  ballsInPlay: number;
}

const HOME_PLATE = { x: 0.5, y: 0.88 };

function isAtPlate(event: BallEvent): boolean {
  return event.fieldX === HOME_PLATE.x && event.fieldY === HOME_PLATE.y;
}

export function ratio(count: number, of: number): Ratio {
  return { count, of };
}

/** Percentage rounded for display, or null when the denominator is zero. */
export function ratePercent(value: Ratio): number | null {
  return value.of ? Math.round((value.count / value.of) * 100) : null;
}

export function groupMetrics(events: readonly BallEvent[]): GroupMetrics {
  const rated = events.filter((e) => e.hardHit !== null && e.hardHit !== undefined);
  const directions = { pull: 0, center: 0, opposite: 0, unknown: 0 };
  for (const event of events) directions[directionFor(event)]++;
  const directional = events.length - directions.unknown;
  const typed = events.filter((e) => e.contactType !== null);
  const inPlay = events.filter((e) => e.hardHit !== 0 && !isAtPlate(e));
  const totalDistance = inPlay.reduce(
    (sum, e) => sum + calculateDistanceFeet(e.fieldX, e.fieldY),
    0,
  );

  return {
    total: events.length,
    hardHit: ratio(rated.filter((e) => e.hardHit! >= 4).length, rated.length),
    whiff: ratio(rated.filter((e) => e.hardHit === 0).length, rated.length),
    pull: ratio(directions.pull, directional),
    center: ratio(directions.center, directional),
    opposite: ratio(directions.opposite, directional),
    lineDrive: ratio(typed.filter((e) => e.contactType === 'line-drive').length, typed.length),
    averageDistanceFeet: inPlay.length ? Math.round(totalDistance / inPlay.length) : null,
    ballsInPlay: inPlay.length,
  };
}

export interface TrendPoint {
  /** Local practice date, YYYY-MM-DD. */
  date: string;
  /** Contacts recorded on this date. */
  contacts: number;
  /** Rolling hard-hit rate over the window ending on this date. */
  hardHit: Ratio;
  /** Rolling whiff rate over the window ending on this date. */
  whiff: Ratio;
}

function localDate(timestamp: string): string {
  const d = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * One point per practice date: hard-hit and whiff rates over the trailing `windowDays` days
 * (inclusive of the practice date). Rates use only contacts with a hard-hit rating.
 */
export function rollingRates(events: readonly BallEvent[], windowDays: number): TrendPoint[] {
  const byDate = new Map<string, BallEvent[]>();
  for (const event of events) {
    const date = localDate(event.timestamp);
    const list = byDate.get(date);
    if (list) list.push(event);
    else byDate.set(date, [event]);
  }
  const dates = [...byDate.keys()].sort();
  return dates.map((date) => {
    const end = dayNumber(date);
    let hard = 0;
    let whiff = 0;
    let rated = 0;
    for (const other of dates) {
      const day = dayNumber(other);
      if (day > end || day <= end - windowDays) continue;
      for (const event of byDate.get(other)!) {
        if (event.hardHit === null || event.hardHit === undefined) continue;
        rated++;
        if (event.hardHit >= 4) hard++;
        if (event.hardHit === 0) whiff++;
      }
    }
    return {
      date,
      contacts: byDate.get(date)!.length,
      hardHit: ratio(hard, rated),
      whiff: ratio(whiff, rated),
    };
  });
}

/** Change in percentage points between the first and last point that have a rate. */
export function trendChange(
  points: readonly TrendPoint[],
  metric: 'hardHit' | 'whiff',
): number | null {
  const rated = points.filter((p) => p[metric].of > 0);
  if (rated.length < 2) return null;
  return ratePercent(rated[rated.length - 1][metric])! - ratePercent(rated[0][metric])!;
}

export type FieldZone =
  'whiff' | 'infield' | 'outfield' | 'warning_track' | 'over_fence' | 'unknown';

export interface EnrichedMetrics {
  distanceFeet: number | null;
  /** Degrees from the center-field line; negative is toward left field. */
  sprayAngleDegrees: number | null;
  direction: 'pull' | 'center' | 'opposite' | 'unknown';
  zone: FieldZone;
}

/** Derived per-contact metrics for the enriched export. Never mutates the event. */
export function enrichedMetrics(event: BallEvent, fence: OutfieldFenceConfig): EnrichedMetrics {
  if (event.hardHit === 0) {
    return { distanceFeet: null, sprayAngleDegrees: null, direction: 'unknown', zone: 'whiff' };
  }
  if (isAtPlate(event)) {
    return { distanceFeet: null, sprayAngleDegrees: null, direction: 'unknown', zone: 'unknown' };
  }
  const distanceFeet = Math.round(calculateDistanceFeet(event.fieldX, event.fieldY));
  const sprayAngleDegrees =
    Math.round(
      ((Math.atan2(event.fieldX - HOME_PLATE.x, HOME_PLATE.y - event.fieldY) * 180) / Math.PI) * 10,
    ) / 10;
  const zone: FieldZone = isOverTheFence(event, fence)
    ? 'over_fence'
    : isWarningTrack(event, fence)
      ? 'warning_track'
      : distanceFeet < 120
        ? 'infield'
        : 'outfield';
  return { distanceFeet, sprayAngleDegrees, direction: directionFor(event), zone };
}

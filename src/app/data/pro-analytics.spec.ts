import { describe, expect, it } from 'vitest';
import { BallEvent, HardHitRating, STANDARD_FENCE_PRESETS } from './models';
import {
  enrichedMetrics,
  groupMetrics,
  ratePercent,
  rollingRates,
  trendChange,
} from './pro-analytics';
import { ENRICHED_CSV_COLUMNS, eventsCsv } from './transfer';

let sequence = 0;
function event(overrides: Partial<BallEvent> = {}): BallEvent {
  sequence++;
  return {
    id: `e${sequence}`,
    schemaVersion: 1,
    teamId: 't1',
    playerId: 'p1',
    sessionId: 's1',
    timestamp: '2026-05-04T18:30:00.000',
    sequence,
    turnSequence: 1,
    contactSequence: sequence,
    fieldX: 0.5,
    fieldY: 0.5,
    coordinateSystemVersion: 1,
    pitcherHand: 'R',
    batterSide: 'R',
    contactType: null,
    result: null,
    hardHit: null,
    notes: '',
    playerName: 'Marcus',
    jerseyNumber: '12',
    createdAt: '2026-05-04T18:30:00.000Z',
    updatedAt: '2026-05-04T18:30:00.000Z',
    ...overrides,
  };
}

const rated = (hardHit: HardHitRating, timestamp: string) => event({ hardHit, timestamp });

describe('groupMetrics', () => {
  it('reports every rate with its own denominator', () => {
    const metrics = groupMetrics([
      event({ hardHit: 5, contactType: 'line-drive', fieldX: 0.3, fieldY: 0.5 }),
      event({ hardHit: 4, contactType: 'fly-ball', fieldX: 0.5, fieldY: 0.2 }),
      event({ hardHit: 1, contactType: null, fieldX: 0.7, fieldY: 0.6 }),
      event({ hardHit: 0, fieldX: 0.5, fieldY: 0.88 }),
      event({ hardHit: null, batterSide: null }),
    ]);

    expect(metrics.total).toBe(5);
    expect(metrics.hardHit).toEqual({ count: 2, of: 4 });
    expect(metrics.whiff).toEqual({ count: 1, of: 4 });
    expect(metrics.lineDrive).toEqual({ count: 1, of: 2 });
    // Right-handed batter: left field (x < 0.5) is pull.
    expect(metrics.pull).toEqual({ count: 1, of: 3 });
    expect(metrics.center).toEqual({ count: 1, of: 3 });
    expect(metrics.opposite).toEqual({ count: 1, of: 3 });
    // The whiff at the plate is not a ball in play.
    expect(metrics.ballsInPlay).toBe(4);
    expect(metrics.averageDistanceFeet).toBeGreaterThan(0);
  });

  it('handles an empty group without dividing by zero', () => {
    const metrics = groupMetrics([]);
    expect(metrics.hardHit).toEqual({ count: 0, of: 0 });
    expect(ratePercent(metrics.hardHit)).toBeNull();
    expect(metrics.averageDistanceFeet).toBeNull();
  });
});

describe('rollingRates', () => {
  const events = [
    rated(0, '2026-05-01T17:00:00'),
    rated(1, '2026-05-01T17:05:00'),
    rated(4, '2026-05-10T17:00:00'),
    rated(5, '2026-05-10T17:05:00'),
    event({ hardHit: null, timestamp: '2026-05-10T17:06:00' }),
    rated(6, '2026-06-20T17:00:00'),
  ];

  it('produces one point per practice date with a trailing window', () => {
    const points = rollingRates(events, 14);
    expect(points.map((p) => p.date)).toEqual(['2026-05-01', '2026-05-10', '2026-06-20']);
    expect(points[0]).toMatchObject({
      contacts: 2,
      hardHit: { count: 0, of: 2 },
      whiff: { count: 1, of: 2 },
    });
    // May 10 window (Apr 27 – May 10) includes May 1; the unrated contact is excluded from rates.
    expect(points[1]).toMatchObject({
      contacts: 3,
      hardHit: { count: 2, of: 4 },
      whiff: { count: 1, of: 4 },
    });
    // June 20 is more than 14 days later: only its own contact counts.
    expect(points[2]).toMatchObject({ hardHit: { count: 1, of: 1 }, whiff: { count: 0, of: 1 } });
  });

  it('reports change in percentage points between first and last rated points', () => {
    const points = rollingRates(events, 14);
    expect(trendChange(points, 'hardHit')).toBe(100);
    expect(trendChange(points, 'whiff')).toBe(-50);
    expect(trendChange(points.slice(0, 1), 'hardHit')).toBeNull();
  });
});

describe('enrichedMetrics', () => {
  const fence = STANDARD_FENCE_PRESETS.high_school;

  it('derives distance, spray angle, direction and zone without touching coordinates', () => {
    const deepCenter = event({ hardHit: 5, contactType: 'fly-ball', fieldX: 0.5, fieldY: 0.06 });
    const metrics = enrichedMetrics(deepCenter, fence);
    expect(metrics.zone).toBe('over_fence');
    expect(metrics.sprayAngleDegrees).toBe(0);
    expect(metrics.direction).toBe('center');
    expect(metrics.distanceFeet).toBeGreaterThan(390);
    expect(deepCenter.fieldY).toBe(0.06);
  });

  it('marks pull-side grounders as infield with a negative angle for left field', () => {
    const metrics = enrichedMetrics(
      event({ hardHit: 2, contactType: 'ground-ball', fieldX: 0.42, fieldY: 0.76 }),
      fence,
    );
    expect(metrics.zone).toBe('infield');
    expect(metrics.sprayAngleDegrees).toBeLessThan(0);
    expect(metrics.direction).toBe('pull');
  });

  it('labels whiffs and unplaced contacts instead of inventing distances', () => {
    expect(enrichedMetrics(event({ hardHit: 0 }), fence).zone).toBe('whiff');
    expect(enrichedMetrics(event({ hardHit: 3, fieldX: 0.5, fieldY: 0.88 }), fence)).toMatchObject({
      zone: 'unknown',
      distanceFeet: null,
    });
  });
});

describe('enriched CSV export', () => {
  it('appends derived columns after the raw ones only when enrichment is requested', () => {
    const contact = event({ hardHit: 5, contactType: 'fly-ball', fieldX: 0.5, fieldY: 0.06 });
    const raw = eventsCsv([contact], [], []);
    const enriched = eventsCsv([contact], [], [], [], {
      fence: STANDARD_FENCE_PRESETS.high_school,
    });

    const rawHeader = raw.split('\r\n')[0].split(',');
    const enrichedHeader = enriched.split('\r\n')[0].split(',');
    expect(enrichedHeader.slice(0, rawHeader.length)).toEqual(rawHeader);
    expect(enrichedHeader.slice(rawHeader.length)).toEqual([...ENRICHED_CSV_COLUMNS]);
    expect(enriched.split('\r\n')[1]).toContain('"over_fence"');
    expect(enriched.split('\r\n')[1]).toContain('"0.06"');
  });
});

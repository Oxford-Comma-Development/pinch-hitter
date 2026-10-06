import { describe, expect, it } from 'vitest';
import { ALIGNMENTS, alignmentCoverage, alignmentZones, dominantSide } from './defense';
import { getReferenceScaleAtAngle } from './domain';
import { BallEvent, STANDARD_FENCE_PRESETS } from './models';

let sequence = 0;
function event(overrides: Partial<BallEvent>): BallEvent {
  sequence++;
  return {
    id: `d${sequence}`,
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
    contactType: 'ground-ball',
    result: null,
    hardHit: 3,
    notes: '',
    playerName: 'Marcus',
    jerseyNumber: '12',
    createdAt: '2026-05-04T18:30:00.000Z',
    updatedAt: '2026-05-04T18:30:00.000Z',
    ...overrides,
  };
}

/** Lands a contact exactly where an alignment's fielder stands (high-school field). */
function atSpot(alignment: keyof typeof ALIGNMENTS, position: string, overrides = {}) {
  const zone = alignmentZones(alignment, 'R').find((z) => z.label === position)!;
  return event({ fieldX: zone.x, fieldY: zone.y, ...overrides });
}

/** A contact landing at a distance and spray angle (negative = left field) on a high-school field. */
function atFeet(feet: number, angleDeg: number, overrides: Partial<BallEvent> = {}) {
  const r = feet / getReferenceScaleAtAngle(angleDeg);
  const radians = (angleDeg * Math.PI) / 180;
  return event({
    fieldX: 0.5 + r * Math.sin(radians),
    fieldY: 0.88 - r * Math.cos(radians),
    ...overrides,
  });
}

describe('alignmentCoverage', () => {
  it('counts a grounder hit right at the shortstop as covered', () => {
    const coverage = alignmentCoverage([atSpot('standard', 'SS')], 'standard');
    expect(coverage.ground).toEqual({ count: 1, of: 1 });
  });

  it('shows the pull shift catching a grounder through the standard 5–6 hole', () => {
    const grounder = atFeet(130, -24);
    expect(alignmentCoverage([grounder], 'pull_shift').ground.count).toBe(1);
    expect(alignmentCoverage([grounder], 'standard').ground.count).toBe(0);
  });

  it('mirrors shifts for left-handed hitters', () => {
    const rightyPull = atSpot('pull_shift', 'SS');
    const leftyPull = event({
      fieldX: 1 - rightyPull.fieldX,
      fieldY: rightyPull.fieldY,
      batterSide: 'L',
    });
    expect(alignmentCoverage([leftyPull], 'pull_shift').ground.count).toBe(1);
    expect(alignmentCoverage([leftyPull], 'oppo_shift').ground.count).toBe(0);
  });

  it('never lets outfielders field ground balls, and never catches home runs', () => {
    const grounderToLeft = atSpot('standard', 'LF');
    const homer = event({ contactType: 'fly-ball', hardHit: 5, fieldX: 0.5, fieldY: 0.05 });
    const coverage = alignmentCoverage([grounderToLeft, homer], 'no_doubles');
    expect(coverage.ground).toEqual({ count: 0, of: 1 });
    expect(coverage.fly).toEqual({ count: 0, of: 1 });
  });

  it('keeps separate denominators and skips whiffs and unclassified contacts', () => {
    const coverage = alignmentCoverage(
      [
        atSpot('standard', 'CF', { contactType: 'fly-ball' }),
        atSpot('standard', 'RF', { contactType: 'line-drive' }),
        event({ hardHit: 0 }),
        event({ contactType: null }),
      ],
      'standard',
    );
    expect(coverage).toEqual({
      ground: { count: 0, of: 0 },
      line: { count: 1, of: 1 },
      fly: { count: 1, of: 1 },
    });
  });

  it('scales positions to a smaller field', () => {
    const littleLeague = STANDARD_FENCE_PRESETS.little_league;
    const zone = alignmentZones('standard', 'R', littleLeague).find((z) => z.label === 'CF')!;
    const shallowFly = event({ contactType: 'fly-ball', fieldX: zone.x, fieldY: zone.y });
    expect(alignmentCoverage([shallowFly], 'standard', littleLeague).fly.count).toBe(1);
    expect(zone.y).toBeGreaterThan(
      alignmentZones('standard', 'R').find((z) => z.label === 'CF')!.y,
    );
  });
});

describe('zones and sides', () => {
  it('places zones inside the normalized field and mirrors for lefties', () => {
    const right = alignmentZones('pull_shift', 'R');
    const left = alignmentZones('pull_shift', 'L');
    for (const zone of right) {
      expect(zone.x).toBeGreaterThan(0);
      expect(zone.x).toBeLessThan(1);
      expect(zone.y).toBeGreaterThan(0);
      expect(zone.y).toBeLessThan(0.88);
    }
    const ss = (zones: typeof right) => zones.find((z) => z.label === 'SS')!;
    expect(ss(right).x).toBeLessThan(0.5);
    expect(ss(left).x).toBeCloseTo(1 - ss(right).x, 6);
  });

  it('picks the dominant batting side', () => {
    expect(dominantSide([event({ batterSide: 'L' }), event({ batterSide: 'L' }), event({})])).toBe(
      'L',
    );
    expect(dominantSide([])).toBe('R');
  });
});

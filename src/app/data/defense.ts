import { calculateDistanceFeet, getReferenceScaleAtAngle, isOverTheFence } from './domain';
import { BallEvent, OutfieldFenceConfig, STANDARD_FENCE_PRESETS } from './models';
import { Ratio, ratio } from './pro-analytics';

/**
 * Pro defensive alignments (TODO-B4). A planning estimate: which recorded contacts landed within a
 * fielder's typical range of where an alignment stations them. Pure; never touches stored data.
 *
 * Spots use feet from home plate and spray angle in degrees from the center-field line. Negative
 * angles are the pull side of a right-handed hitter (left field); left-handed contacts are mirrored.
 */

export type AlignmentId = 'standard' | 'pull_shift' | 'oppo_shift' | 'infield_in' | 'no_doubles';

export const ALIGNMENT_IDS: readonly AlignmentId[] = [
  'standard',
  'pull_shift',
  'oppo_shift',
  'infield_in',
  'no_doubles',
];

export interface FielderSpot {
  position: 'P' | '1B' | '2B' | 'SS' | '3B' | 'LF' | 'CF' | 'RF';
  distanceFeet: number;
  angleDeg: number;
  /** Reach on ground balls (0 for outfielders: a grounder that reaches them is through). */
  groundRangeFeet: number;
  /** Reach on line drives, fly balls, and pop-ups. */
  airRangeFeet: number;
}

type Position = FielderSpot['position'];

function infielder(
  position: Position,
  distanceFeet: number,
  angleDeg: number,
  groundRangeFeet = 22,
) {
  return {
    position,
    distanceFeet,
    angleDeg,
    groundRangeFeet: position === 'P' ? 12 : groundRangeFeet,
    airRangeFeet: 18,
  };
}

function outfielder(position: Position, distanceFeet: number, angleDeg: number): FielderSpot {
  return { position, distanceFeet, angleDeg, groundRangeFeet: 0, airRangeFeet: 70 };
}

const STANDARD_INFIELD = [
  infielder('P', 60, 0),
  infielder('1B', 110, 35),
  infielder('2B', 150, 14),
  infielder('SS', 150, -14),
  infielder('3B', 115, -33),
];
const STANDARD_OUTFIELD = [
  outfielder('LF', 285, -28),
  outfielder('CF', 320, 0),
  outfielder('RF', 285, 28),
];
const PULL_SHIFT = [
  infielder('P', 60, 0),
  infielder('1B', 110, 33),
  infielder('2B', 150, -4),
  infielder('SS', 150, -22),
  infielder('3B', 118, -37),
  outfielder('LF', 280, -33),
  outfielder('CF', 315, -10),
  outfielder('RF', 290, 16),
];

export const ALIGNMENTS: Readonly<Record<AlignmentId, readonly FielderSpot[]>> = {
  standard: [...STANDARD_INFIELD, ...STANDARD_OUTFIELD],
  pull_shift: PULL_SHIFT,
  oppo_shift: PULL_SHIFT.map((spot) => ({ ...spot, angleDeg: -spot.angleDeg })),
  infield_in: [
    infielder('P', 60, 0),
    infielder('1B', 90, 36, 18),
    infielder('2B', 110, 14, 18),
    infielder('SS', 110, -14, 18),
    infielder('3B', 90, -33, 18),
    ...STANDARD_OUTFIELD,
  ],
  no_doubles: [
    ...STANDARD_INFIELD,
    outfielder('LF', 320, -27),
    outfielder('CF', 350, 0),
    outfielder('RF', 320, 27),
  ],
};

export interface AlignmentCoverage {
  /** Ground balls and dribblers. */
  ground: Ratio;
  line: Ratio;
  /** Fly balls and pop-ups. Balls over the fence count as not covered. */
  fly: Ratio;
}

export interface ZoneCircle {
  /** Normalized field coordinates (ADR-007). */
  x: number;
  y: number;
  r: number;
  label: string;
}

const HOME = { x: 0.5, y: 0.88 };
const REFERENCE_CENTER_FEET = 390;

function fenceScale(fence: OutfieldFenceConfig): number {
  return fence.centerFeet / REFERENCE_CENTER_FEET;
}

function spotFeet(spot: FielderSpot, mirror: boolean, scale: number) {
  const angle = ((mirror ? -spot.angleDeg : spot.angleDeg) * Math.PI) / 180;
  const distance = spot.distanceFeet * scale;
  return { x: distance * Math.sin(angle), y: distance * Math.cos(angle) };
}

function eventFeet(event: BallEvent) {
  const angle = Math.atan2(event.fieldX - HOME.x, HOME.y - event.fieldY);
  const distance = calculateDistanceFeet(event.fieldX, event.fieldY);
  return { x: distance * Math.sin(angle), y: distance * Math.cos(angle) };
}

function covered(
  event: BallEvent,
  spots: readonly FielderSpot[],
  range: 'groundRangeFeet' | 'airRangeFeet',
  scale: number,
): boolean {
  const point = eventFeet(event);
  // Unknown batting side is treated as right-handed.
  const mirror = event.batterSide === 'L';
  return spots.some((spot) => {
    const reach = spot[range] * scale;
    if (reach <= 0) return false;
    const fielder = spotFeet(spot, mirror, scale);
    return Math.hypot(point.x - fielder.x, point.y - fielder.y) <= reach;
  });
}

/** Coverage of classified, placed, non-whiff contacts. Each rate carries its own denominator. */
export function alignmentCoverage(
  events: readonly BallEvent[],
  id: AlignmentId,
  fence: OutfieldFenceConfig = STANDARD_FENCE_PRESETS.high_school,
): AlignmentCoverage {
  const spots = ALIGNMENTS[id];
  const scale = fenceScale(fence);
  const tally = { ground: [0, 0], line: [0, 0], fly: [0, 0] };
  for (const event of events) {
    if (event.hardHit === 0) continue;
    if (event.fieldX === HOME.x && event.fieldY === HOME.y) continue;
    switch (event.contactType) {
      case 'ground-ball':
      case 'dribbler':
        tally.ground[1]++;
        if (covered(event, spots, 'groundRangeFeet', scale)) tally.ground[0]++;
        break;
      case 'line-drive':
        tally.line[1]++;
        if (covered(event, spots, 'airRangeFeet', scale)) tally.line[0]++;
        break;
      case 'fly-ball':
      case 'pop-up':
        tally.fly[1]++;
        if (!isOverTheFence(event, fence) && covered(event, spots, 'airRangeFeet', scale))
          tally.fly[0]++;
        break;
    }
  }
  return {
    ground: ratio(tally.ground[0], tally.ground[1]),
    line: ratio(tally.line[0], tally.line[1]),
    fly: ratio(tally.fly[0], tally.fly[1]),
  };
}

/** The batting side most of these contacts came from (right when tied or unknown). */
export function dominantSide(events: readonly BallEvent[]): 'L' | 'R' {
  const left = events.filter((e) => e.batterSide === 'L').length;
  const right = events.filter((e) => e.batterSide === 'R').length;
  return left > right ? 'L' : 'R';
}

/** Range circles for drawing, in normalized coordinates, oriented for the given batting side. */
export function alignmentZones(
  id: AlignmentId,
  side: 'L' | 'R',
  fence: OutfieldFenceConfig = STANDARD_FENCE_PRESETS.high_school,
): ZoneCircle[] {
  const scale = fenceScale(fence);
  return ALIGNMENTS[id].map((spot) => {
    const angleDeg = side === 'L' ? -spot.angleDeg : spot.angleDeg;
    const unitsPerFoot = 1 / getReferenceScaleAtAngle(angleDeg);
    const radians = (angleDeg * Math.PI) / 180;
    const radius = spot.distanceFeet * scale * unitsPerFoot;
    const reach = Math.max(spot.groundRangeFeet, spot.airRangeFeet) * scale * unitsPerFoot;
    return {
      x: HOME.x + radius * Math.sin(radians),
      y: HOME.y - radius * Math.cos(radians),
      r: reach,
      label: spot.position,
    };
  });
}

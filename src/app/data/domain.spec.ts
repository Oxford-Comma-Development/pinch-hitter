import { describe, expect, it } from 'vitest';
import {
  advanceTurn,
  createContact,
  deferQueue,
  densityBins,
  directionFor,
  filterEvents,
  jumpQueue,
  normalizedPoint,
  reorderUpcoming,
  rotateQueue,
  summarizeEvents,
  undoContact,
  calculateDistanceFeet,
  generateFenceSvgPath,
  generateWarningTrackSvgPath,
  getFenceDistanceAtAngle,
  getFenceDistanceMarkers,
  isOverTheFence,
  isWarningTrack,
} from './domain';
import { Player, PracticeSession, STANDARD_FENCE_PRESETS } from './models';

const now = '2026-05-04T18:30:00.000Z';
const player: Player = {
  id: 'p1',
  teamId: 't1',
  name: 'Marcus',
  jerseyNumber: '12',
  grade: '',
  bats: 'R',
  throws: 'R',
  positions: ['SS'],
  notes: '',
  active: true,
  order: 0,
  createdAt: now,
  updatedAt: now,
};
const session = (rotationCount: number | null = null): PracticeSession => ({
  id: 's1',
  teamId: 't1',
  startedAt: now,
  endedAt: null,
  title: 'Practice',
  location: '',
  notes: '',
  participantIds: ['p1', 'p2', 'p3'],
  queue: ['p1', 'p2', 'p3'],
  currentTurn: 1,
  turnContacts: 0,
  nextSequence: 1,
  rotationCount,
  pitcherHand: 'R',
  undoStack: [],
  createdAt: now,
  updatedAt: now,
});
const capture = (practice = session(), x = 0.3, y = 0.3) =>
  createContact(practice, player, x, y, { now, id: `e${practice.nextSequence}` });

describe('practice queue and capture', () => {
  it('cycles FIFO without mutating the queue, including empty and one hitter', () => {
    const queue = ['p1', 'p2', 'p3'];
    expect(rotateQueue(queue)).toEqual(['p2', 'p3', 'p1']);
    expect(queue[0]).toBe('p1');
    expect(rotateQueue([])).toEqual([]);
    expect(rotateQueue(['p1'])).toEqual(['p1']);
  });
  it('defers the current or a named upcoming hitter to the end', () => {
    expect(deferQueue(['p1', 'p2', 'p3'])).toEqual(['p2', 'p3', 'p1']);
    expect(deferQueue(['p1', 'p2', 'p3'], 'p2')).toEqual(['p1', 'p3', 'p2']);
    expect(deferQueue(['p1'], 'absent')).toEqual(['p1']);
  });
  it('reorders upcoming hitters while preserving current and rejects duplicates or omissions', () => {
    expect(reorderUpcoming(['p1', 'p2', 'p3'], ['p3', 'p2'])).toEqual(['p1', 'p3', 'p2']);
    expect(reorderUpcoming(['p1', 'p2', 'p3'], ['p1', 'p3', 'p2'])).toEqual(['p1', 'p3', 'p2']);
    expect(() => reorderUpcoming(['p1', 'p2', 'p3'], ['p2', 'p2'])).toThrow();
    expect(() => reorderUpcoming(['p1', 'p2'], [])).toThrow();
  });
  it('jumps to a player while preserving the cycling relative order', () => {
    expect(jumpQueue(['p1', 'p2', 'p3'], 'p3')).toEqual(['p3', 'p1', 'p2']);
    expect(jumpQueue(['p1', 'p2'], 'p3')).toEqual(['p3', 'p1', 'p2']);
  });
  it('records five location-only contacts for one hitter in manual mode', () => {
    let practice = session();
    for (let i = 1; i <= 5; i++) {
      const result = capture(practice);
      practice = result.session;
      expect(result.event.contactSequence).toBe(i);
      expect(result.event.playerId).toBe('p1');
      expect(result.event.contactType).toBeNull();
      expect(result.event.result).toBeNull();
    }
    expect(practice.queue[0]).toBe('p1');
    expect(practice.turnContacts).toBe(5);
    expect(advanceTurn(practice)).toMatchObject({
      queue: ['p2', 'p3', 'p1'],
      turnContacts: 0,
      currentTurn: 2,
    });
  });
  it.each([1, 3, 5, 8])('automatically advances after exactly %i recorded contacts', (count) => {
    let practice = session(count);
    for (let i = 1; i <= count; i++) {
      practice = capture(practice).session;
      expect(practice.queue[0]).toBe(i === count ? 'p2' : 'p1');
    }
    expect(practice.turnContacts).toBe(0);
    expect(practice.currentTurn).toBe(2);
  });
  it('undo restores the queue and turn count before automatic advancement', () => {
    const first = capture(session(3)).session;
    const second = capture(first).session;
    const third = capture(second);
    const undo = undoContact(third.session)!;
    expect(undo.eventId).toBe('e3');
    expect(undo.session.queue).toEqual(['p1', 'p2', 'p3']);
    expect(undo.session.turnContacts).toBe(2);
    expect(undo.session.currentTurn).toBe(1);
    expect(undo.session.nextSequence).toBe(4);
    expect(capture(undo.session).event.sequence).toBe(4);
  });
  it('does not reverse a deliberate hitter change performed after capture', () => {
    const first = capture().session;
    const manuallyAdvanced = advanceTurn(first);
    const undo = undoContact(manuallyAdvanced)!;
    expect(undo.session.queue).toEqual(manuallyAdvanced.queue);
    expect(undo.session.turnContacts).toBe(0);
  });
  it('persists event-time identity and handedness, leaving switch side unknown unless supplied', () => {
    const practice = { ...session(), pitcherHand: 'L' as const };
    const result = capture(practice);
    expect(result.event).toMatchObject({
      pitcherHand: 'L',
      batterSide: 'R',
      playerName: 'Marcus',
      jerseyNumber: '12',
      fieldX: 0.3,
      fieldY: 0.3,
      coordinateSystemVersion: 1,
      sequence: 1,
      turnSequence: 1,
      timestamp: now,
    });
    expect(result.session.pitcherHand).toBe('L');
    expect(
      createContact(practice, { ...player, bats: 'S' }, 0.5, 0.5, { now }).event.batterSide,
    ).toBeNull();
    expect(
      createContact(practice, { ...player, bats: 'S' }, 0.5, 0.5, { now, batterSide: 'L' }).event
        .batterSide,
    ).toBe('L');
  });
  it('rejects invalid locations, ended sessions, and the wrong hitter', () => {
    expect(() => capture(session(), 1.1)).toThrow();
    expect(() => capture(session(), NaN)).toThrow();
    expect(() => capture({ ...session(), endedAt: now })).toThrow();
    expect(() => createContact(session(), { ...player, id: 'p2' }, 0.5, 0.5)).toThrow();
  });
  it('keeps at most 100 persisted undo snapshots without losing sequence counts', () => {
    let practice = session();
    for (let i = 0; i < 110; i++) practice = capture(practice).session;
    expect(practice.undoStack).toHaveLength(100);
    expect(practice.nextSequence).toBe(111);
  });
});

describe('coordinates and reporting', () => {
  it('maps the same SVG point independently of viewport scale and letterboxing', () => {
    expect(normalizedPoint(205, 260, { left: 10, top: 20, width: 390, height: 390 })).toEqual({
      fieldX: 0.5,
      fieldY: 240 / 390,
    });
    expect(normalizedPoint(422, 195, { left: 0, top: 0, width: 844, height: 390 })).toEqual({
      fieldX: 0.5,
      fieldY: 0.5,
    });
    expect(normalizedPoint(-1, 200, { left: 0, top: 0, width: 100, height: 100 })).toEqual({
      fieldX: 0,
      fieldY: 1,
    });
    expect(() => normalizedPoint(1, 1, { left: 0, top: 0, width: 0, height: 0 })).toThrow();
  });
  it('combines filters and distinguishes null/unclassified from all', () => {
    const a = capture().event;
    const b = {
      ...a,
      id: 'e2',
      pitcherHand: 'L' as const,
      contactType: 'line-drive' as const,
      result: 'single' as const,
    };
    expect(
      filterEvents([a, b], {
        pitcherHand: 'L',
        contactType: 'line-drive',
        result: 'single',
        playerIds: ['p1'],
        sessionIds: ['s1'],
      }),
    ).toEqual([b]);
    expect(filterEvents([a, b], { contactType: null })).toEqual([a]);
    expect(filterEvents([a], { from: '2027-01-01' })).toEqual([]);
    expect(filterEvents([a], { from: '2026-05-04', to: '2026-05-04' })).toHaveLength(1);
  });
  it('reports missing classifications explicitly and uses event-time side for direction', () => {
    const a = capture().event;
    const b = {
      ...a,
      id: 'e2',
      contactType: 'line-drive' as const,
      pitcherHand: null,
      result: 'single' as const,
      batterSide: null,
    };
    expect(summarizeEvents([a, b])).toMatchObject({
      total: 2,
      classifiedContacts: 1,
      classifiedResults: 1,
      contacts: { unclassified: 1, 'line-drive': 1 },
      pitcherHands: { R: 1, L: 0, unknown: 1 },
      directions: { pull: 1, unknown: 1 },
    });
    expect(directionFor({ ...a, batterSide: 'L' })).toBe('opposite');
    expect(directionFor({ ...a, fieldX: 0.5, fieldY: 0.88 })).toBe('unknown');
    expect(directionFor({ ...a, fieldX: 0.5 })).toBe('center');
  });
  it('filters and summarizes hard hit ratings, contact hits, and whiffs', () => {
    const normal = capture().event;
    const whiff = {
      ...normal,
      id: 'e2',
      fieldX: 0.5,
      fieldY: 0.88,
      hardHit: 0 as const,
      contactType: null,
      result: 'out' as const,
    };
    const crushed = {
      ...normal,
      id: 'e3',
      fieldX: 0.8,
      fieldY: 0.2,
      hardHit: 5 as const,
      contactType: 'fly-ball' as const,
      result: 'home-run' as const,
    };
    const medium = {
      ...normal,
      id: 'e4',
      fieldX: 0.4,
      fieldY: 0.4,
      hardHit: 3 as const,
      contactType: 'line-drive' as const,
      result: 'single' as const,
    };
    const plakata = {
      ...normal,
      id: 'e5',
      fieldX: 0.5,
      fieldY: 0.1,
      hardHit: 6 as const,
      contactType: 'fly-ball' as const,
      result: 'home-run' as const,
    };
    const events = [normal, whiff, crushed, medium, plakata];

    expect(filterEvents(events, { hardHit: 0 })).toEqual([whiff]);
    expect(filterEvents(events, { hardHit: 5 })).toEqual([crushed]);
    expect(filterEvents(events, { hardHit: 6 })).toEqual([plakata]);
    expect(filterEvents(events, { hardHit: null })).toEqual([normal]);

    const summary = summarizeEvents(events);
    expect(summary.total).toBe(5);
    expect(summary.classifiedHardHits).toBe(4);
    expect(summary.swingsAndMisses).toBe(1);
    expect(summary.contactHits).toBe(4);
    expect(summary.hardHitCount).toBe(2); // rating 4, 5, or 6
    expect(summary.hardHits).toEqual({
      0: 1,
      3: 1,
      5: 1,
      6: 1,
      unclassified: 1,
    });
  });
  it('bins edge coordinates and normalizes density without changing observations or counting whiffs', () => {
    const a = capture().event;
    const b = { ...a, id: 'e2', fieldX: 1, fieldY: 1 };
    const whiff = { ...a, id: 'e3', fieldX: 0.5, fieldY: 0.88, hardHit: 0 as const };
    const bins = densityBins([a, a, b, whiff], 10);
    expect(bins).toHaveLength(2);
    expect(bins.find((bin) => bin.count === 2)?.intensity).toBe(1);
    expect(bins.find((bin) => bin.count === 1)).toMatchObject({ x: 0.95, y: 0.95, intensity: 0.5 });
    expect(b.fieldX).toBe(1);
  });
});

describe('outfield fence mathematics and geometry', () => {
  const hsFence = STANDARD_FENCE_PRESETS.high_school;
  const llFence = STANDARD_FENCE_PRESETS.little_league;

  it('calculates fence distance at key angles for standard presets', () => {
    // High School: 315 LF, 365 LCF, 390 CF, 365 RCF, 315 RF
    expect(getFenceDistanceAtAngle(-45, hsFence)).toBe(315);
    expect(getFenceDistanceAtAngle(-22.5, hsFence)).toBe(365);
    expect(getFenceDistanceAtAngle(0, hsFence)).toBe(390);
    expect(getFenceDistanceAtAngle(22.5, hsFence)).toBe(365);
    expect(getFenceDistanceAtAngle(45, hsFence)).toBe(315);

    // Little League: 200 uniform
    expect(getFenceDistanceAtAngle(-45, llFence)).toBe(200);
    expect(getFenceDistanceAtAngle(0, llFence)).toBe(200);
    expect(getFenceDistanceAtAngle(45, llFence)).toBe(200);
  });

  it('calculates physical distance in feet from home plate', () => {
    // Home plate itself (0.50, 0.88)
    expect(calculateDistanceFeet(0.5, 0.88)).toBe(0);

    // Center field apex (0.50, 0.08) should be 390 feet on standard diamond
    const cfDist = calculateDistanceFeet(0.5, 0.08);
    expect(Math.round(cfDist)).toBe(390);

    // Halfway to center field (0.50, 0.48) should be approximately 195 feet
    const midDist = calculateDistanceFeet(0.5, 0.48);
    expect(Math.round(midDist)).toBe(195);

    // Left foul line at 436 units away (0.50 - 0.436 = 0.064, 0.88 - 0.436 = 0.444)
    const lfPoleDist = calculateDistanceFeet(0.064, 0.444);
    expect(Math.round(lfPoleDist)).toBe(315);
  });

  it('accurately classifies over-the-fence home runs versus field hits', () => {
    // Fly ball hit 400 ft to dead center (fieldX: 0.50, fieldY: 0.06)
    const deepFly = {
      fieldX: 0.5,
      fieldY: 0.05,
      contactType: 'fly-ball' as const,
      hardHit: 5 as const,
    };
    expect(isOverTheFence(deepFly, hsFence)).toBe(true);

    // Shallow fly ball 250 ft to center (fieldX: 0.50, fieldY: 0.35)
    const shallowFly = {
      fieldX: 0.5,
      fieldY: 0.35,
      contactType: 'fly-ball' as const,
      hardHit: 3 as const,
    };
    expect(isOverTheFence(shallowFly, hsFence)).toBe(false);

    // The same 250 ft fly ball is OVER the fence on a Little League diamond (200 ft)!
    expect(isOverTheFence(shallowFly, llFence)).toBe(true);

    // Ground balls and swings/misses are never over the fence regardless of landing coordinates
    const groundBall = {
      fieldX: 0.5,
      fieldY: 0.05,
      contactType: 'ground-ball' as const,
      hardHit: 4 as const,
    };
    expect(isOverTheFence(groundBall, hsFence)).toBe(false);

    const whiff = {
      fieldX: 0.5,
      fieldY: 0.88,
      contactType: null,
      hardHit: 0 as const,
    };
    expect(isOverTheFence(whiff, hsFence)).toBe(false);
  });

  it('accurately identifies warning track balls', () => {
    // High School center field is 390 ft with 15 ft warning track (375-389 ft)
    // 380 ft fly ball in center field
    // dNorm = 380 / (390 / 0.80) = 0.7794 => fieldY = 0.88 - 0.7794 = 0.1006
    const warningTrackFly = {
      fieldX: 0.5,
      fieldY: 0.101,
      contactType: 'fly-ball' as const,
      hardHit: 4 as const,
    };
    expect(isWarningTrack(warningTrackFly, hsFence)).toBe(true);
    expect(isOverTheFence(warningTrackFly, hsFence)).toBe(false);

    // Deeper ball (400 ft) is a home run, not warning track
    const homeRunFly = {
      fieldX: 0.5,
      fieldY: 0.05,
      contactType: 'fly-ball' as const,
      hardHit: 5 as const,
    };
    expect(isWarningTrack(homeRunFly, hsFence)).toBe(false);

    // Infield/shallow ball is neither
    const infieldPop = {
      fieldX: 0.5,
      fieldY: 0.65,
      contactType: 'pop-up' as const,
      hardHit: 2 as const,
    };
    expect(isWarningTrack(infieldPop, hsFence)).toBe(false);
  });

  it('generates valid SVG path strings for fence and warning track', () => {
    const fencePath = generateFenceSvgPath(hsFence);
    expect(fencePath.startsWith('M')).toBe(true);
    expect(fencePath.includes('L')).toBe(true);

    const trackPath = generateWarningTrackSvgPath(hsFence);
    expect(trackPath.startsWith('M')).toBe(true);
    expect(trackPath.endsWith('Z')).toBe(true);

    const markers = getFenceDistanceMarkers(hsFence);
    expect(markers).toHaveLength(5);
    expect(markers[0].label).toBe("315'");
    expect(markers[2].label).toBe("390'");
    expect(markers[4].label).toBe("315'");
  });
});

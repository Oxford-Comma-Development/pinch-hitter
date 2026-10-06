import { BallEvent, ContactType, HardHitRating, Player } from '../data/models';

/**
 * Deterministic sample hitters for Pro previews. Never written to storage, never mixed with the
 * coach's notebook, and always labelled "Sample data" in the UI.
 */

const DEMO_TEAM = 'demo-team';
const CONTACT_TYPES: ContactType[] = [
  'ground-ball',
  'line-drive',
  'fly-ball',
  'pop-up',
  'dribbler',
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function demoPlayer(id: string, name: string, jersey: string, bats: Player['bats']): Player {
  const stamp = '2026-01-01T00:00:00.000Z';
  return {
    id,
    teamId: DEMO_TEAM,
    name,
    jerseyNumber: jersey,
    grade: '',
    bats,
    throws: 'R',
    positions: [],
    notes: '',
    active: true,
    order: 0,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export const DEMO_PLAYERS: readonly Player[] = [
  demoPlayer('demo-a', 'Sample Hitter A', '7', 'R'),
  demoPlayer('demo-b', 'Sample Hitter B', '22', 'S'),
];

function generate(): BallEvent[] {
  const random = mulberry32(2026);
  const events: BallEvent[] = [];
  const start = Date.UTC(2026, 2, 2, 22);
  let sequence = 0;
  for (let practice = 0; practice < 10; practice++) {
    const timestamp = new Date(start + practice * 5 * 86_400_000).toISOString();
    for (const player of DEMO_PLAYERS) {
      const improving = player.id === 'demo-b';
      for (let i = 0; i < 9; i++) {
        sequence++;
        // Sample Hitter B steadily squares the ball up more and misses less.
        const skill = improving ? 0.35 + practice * 0.05 : 0.5;
        const whiff = random() < (improving ? 0.3 - practice * 0.022 : 0.16);
        const side = player.bats === 'S' ? (i % 3 === 0 ? 'L' : 'R') : player.bats;
        const pullBias = side === 'R' ? -1 : 1;
        // Fair territory only: within 42° of the center-field line.
        const degrees = Math.max(-42, Math.min(42, random() * 76 - 38 + pullBias * 10));
        const angle = degrees * (Math.PI / 180);
        // Stay inside the drawn outfield, which is shallower toward the foul poles.
        const maxDepth = 0.8 - (Math.abs(degrees) / 45) * 0.2;
        const depth = Math.min(maxDepth, 0.18 + random() * (0.45 + skill * 0.3));
        const hardHit = (
          whiff ? 0 : Math.min(6, Math.max(1, Math.round(1 + skill * 4 + random() * 2 - 0.5)))
        ) as HardHitRating;
        events.push({
          id: `demo-${sequence}`,
          schemaVersion: 1,
          teamId: DEMO_TEAM,
          playerId: player.id,
          sessionId: `demo-session-${practice}`,
          timestamp: new Date(Date.parse(timestamp) + i * 60_000).toISOString(),
          sequence,
          turnSequence: 1,
          contactSequence: i + 1,
          fieldX: whiff ? 0.5 : Math.min(0.98, Math.max(0.02, 0.5 + Math.sin(angle) * depth)),
          fieldY: whiff ? 0.88 : Math.min(0.86, Math.max(0.04, 0.88 - Math.cos(angle) * depth)),
          coordinateSystemVersion: 1,
          pitcherHand: 'R',
          batterSide: side,
          contactType: whiff ? null : CONTACT_TYPES[Math.floor(random() * CONTACT_TYPES.length)],
          result: null,
          hardHit,
          notes: '',
          playerName: player.name,
          jerseyNumber: player.jerseyNumber,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }
  }
  return events;
}

export const DEMO_EVENTS: readonly BallEvent[] = generate();

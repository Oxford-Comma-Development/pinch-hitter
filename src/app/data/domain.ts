import {
  BallEvent,
  BatterSide,
  ContactType,
  EventFilters,
  HardHitRating,
  HitResult,
  OutfieldFenceConfig,
  Player,
  PracticeSession,
  STANDARD_FENCE_PRESETS,
  TurnState,
} from './models';

export function rotateQueue(queue: readonly string[]): string[] {
  return queue.length > 1 ? [...queue.slice(1), queue[0]] : [...queue];
}
export function deferQueue(queue: readonly string[], playerId = queue[0]): string[] {
  return queue.includes(playerId)
    ? [...queue.filter((id) => id !== playerId), playerId]
    : [...queue];
}
/** Reordering never changes the current hitter; use selectBatter for that. */
export function reorderUpcoming(
  queue: readonly string[],
  upcomingIds: readonly string[],
): string[] {
  if (!queue.length) return [];
  const upcoming = upcomingIds.filter((id) => id !== queue[0]);
  if (
    new Set(upcoming).size !== upcoming.length ||
    upcoming.length !== queue.length - 1 ||
    upcoming.some((id) => !queue.includes(id))
  ) {
    throw new Error('The upcoming order must contain each queued hitter exactly once.');
  }
  return [queue[0], ...upcoming];
}
export function jumpQueue(queue: readonly string[], playerId: string): string[] {
  const index = queue.indexOf(playerId);
  return index < 0 ? [playerId, ...queue] : [...queue.slice(index), ...queue.slice(0, index)];
}
export function turnState(session: TurnState): TurnState {
  return {
    queue: [...session.queue],
    currentTurn: session.currentTurn,
    turnContacts: session.turnContacts,
    nextSequence: session.nextSequence,
  };
}
export function advanceTurn<T extends TurnState>(session: T): T {
  return {
    ...session,
    queue: rotateQueue(session.queue),
    currentTurn: session.currentTurn + 1,
    turnContacts: 0,
  };
}
/** Screen coordinates must be relative to the actual square SVG viewport, including letterboxing. */
export function normalizedPoint(
  clientX: number,
  clientY: number,
  bounds: { left: number; top: number; width: number; height: number },
): { fieldX: number; fieldY: number } {
  const size = Math.min(bounds.width, bounds.height);
  if (size <= 0 || !Number.isFinite(size)) throw new Error('The field must have a visible size.');
  const left = bounds.left + (bounds.width - size) / 2;
  const top = bounds.top + (bounds.height - size) / 2;
  return {
    fieldX: Math.max(0, Math.min(1, (clientX - left) / size)),
    fieldY: Math.max(0, Math.min(1, (clientY - top) / size)),
  };
}
export function assertCoordinates(x: number, y: number): void {
  if (![x, y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1))
    throw new Error('Field coordinates must be between 0 and 1.');
}
export function createContact(
  session: PracticeSession,
  player: Player,
  fieldX: number,
  fieldY: number,
  options: {
    id?: string;
    now?: string;
    batterSide?: BatterSide;
    hardHit?: HardHitRating | null;
    contactType?: ContactType | null;
    result?: HitResult | null;
  } = {},
): { event: BallEvent; session: PracticeSession } {
  assertCoordinates(fieldX, fieldY);
  if (session.endedAt || session.queue[0] !== player.id || player.teamId !== session.teamId)
    throw new Error('Choose a current hitter in an active practice first.');
  const now = options.now ?? new Date().toISOString();
  const event: BallEvent = {
    id: options.id ?? crypto.randomUUID(),
    schemaVersion: 1,
    teamId: session.teamId,
    playerId: player.id,
    sessionId: session.id,
    timestamp: now,
    sequence: session.nextSequence,
    turnSequence: session.currentTurn,
    contactSequence: session.turnContacts + 1,
    fieldX,
    fieldY,
    coordinateSystemVersion: 1,
    pitcherHand: session.pitcherHand,
    batterSide:
      options.batterSide === undefined
        ? player.bats === 'S'
          ? null
          : player.bats
        : options.batterSide,
    contactType: options.contactType ?? null,
    result: options.result ?? null,
    hardHit: options.hardHit ?? null,
    notes: '',
    playerName: player.name,
    jerseyNumber: player.jerseyNumber,
    createdAt: now,
    updatedAt: now,
  };
  let updated: PracticeSession = {
    ...session,
    turnContacts: session.turnContacts + 1,
    nextSequence: session.nextSequence + 1,
    updatedAt: now,
  };
  if (session.rotationCount !== null && updated.turnContacts >= session.rotationCount)
    updated = advanceTurn(updated);
  // Keep the latest 100 reversible captures; old observations remain intact and editable in history.
  updated.undoStack = [
    ...session.undoStack,
    { eventId: event.id, before: turnState(session), after: turnState(updated) },
  ].slice(-100);
  return { event, session: updated };
}
export function undoContact(
  session: PracticeSession,
): { session: PracticeSession; eventId: string } | null {
  const last = session.undoStack.at(-1);
  if (!last) return null;
  const sameTurn = session.currentTurn === last.after.currentTurn;
  const unchanged =
    sameTurn &&
    session.turnContacts === last.after.turnContacts &&
    session.queue.join('|') === last.after.queue.join('|');
  // A later deliberate queue change wins; only unwind automatic advancement when still at its resulting state.
  const state = unchanged
    ? last.before
    : {
        ...turnState(session),
        turnContacts:
          session.currentTurn === last.before.currentTurn
            ? Math.max(0, session.turnContacts - 1)
            : session.turnContacts,
      };
  return {
    eventId: last.eventId,
    session: {
      ...session,
      ...state,
      nextSequence: session.nextSequence,
      undoStack: session.undoStack.slice(0, -1),
      updatedAt: new Date().toISOString(),
    },
  };
}
export function filterEvents(events: readonly BallEvent[], filters: EventFilters): BallEvent[] {
  const from = filters.from
    ? Date.parse(filters.from.length === 10 ? `${filters.from}T00:00:00` : filters.from)
    : -Infinity;
  const to = filters.to
    ? Date.parse(filters.to.length === 10 ? `${filters.to}T23:59:59.999` : filters.to)
    : Infinity;
  const players = filters.playerIds ? new Set(filters.playerIds) : null;
  const sessions = filters.sessionIds ? new Set(filters.sessionIds) : null;
  return events.filter(
    (event) =>
      (!filters.teamId || event.teamId === filters.teamId) &&
      (!filters.playerId || event.playerId === filters.playerId) &&
      (!players || players.has(event.playerId)) &&
      (!filters.sessionId || event.sessionId === filters.sessionId) &&
      (!sessions || sessions.has(event.sessionId)) &&
      (filters.pitcherHand === undefined || event.pitcherHand === filters.pitcherHand) &&
      (filters.contactType === undefined || event.contactType === filters.contactType) &&
      (filters.result === undefined || event.result === filters.result) &&
      (filters.hardHit === undefined || event.hardHit === filters.hardHit) &&
      Date.parse(event.timestamp) >= from &&
      Date.parse(event.timestamp) <= to,
  );
}
export function directionFor(
  event: Pick<BallEvent, 'fieldX' | 'fieldY' | 'batterSide'>,
): 'pull' | 'center' | 'opposite' | 'unknown' {
  if (!event.batterSide || (event.fieldX === 0.5 && event.fieldY === 0.88)) return 'unknown';
  const angle = (Math.atan2(event.fieldX - 0.5, 0.88 - event.fieldY) * 180) / Math.PI;
  if (Math.abs(angle) <= 15) return 'center';
  return (angle < 0 && event.batterSide === 'R') || (angle > 0 && event.batterSide === 'L')
    ? 'pull'
    : 'opposite';
}
export function summarizeEvents(events: readonly BallEvent[]) {
  const contacts: Record<string, number> = {};
  const results: Record<string, number> = {};
  const hardHits: Record<string, number> = {};
  const byPlayer: Record<string, number> = {};
  const pitcherHands = { R: 0, L: 0, unknown: 0 };
  const directions = { pull: 0, center: 0, opposite: 0, unknown: 0 };
  for (const event of events) {
    contacts[event.contactType ?? 'unclassified'] =
      (contacts[event.contactType ?? 'unclassified'] ?? 0) + 1;
    results[event.result ?? 'unclassified'] = (results[event.result ?? 'unclassified'] ?? 0) + 1;
    hardHits[
      event.hardHit !== null && event.hardHit !== undefined ? String(event.hardHit) : 'unclassified'
    ] =
      (hardHits[
        event.hardHit !== null && event.hardHit !== undefined
          ? String(event.hardHit)
          : 'unclassified'
      ] ?? 0) + 1;
    byPlayer[event.playerId] = (byPlayer[event.playerId] ?? 0) + 1;
    pitcherHands[event.pitcherHand ?? 'unknown']++;
    directions[directionFor(event)]++;
  }
  const classifiedHardHits = events.filter(
    (e) => e.hardHit !== null && e.hardHit !== undefined,
  ).length;
  const hardHitCount = events.filter(
    (e) => e.hardHit === 4 || e.hardHit === 5 || e.hardHit === 6,
  ).length;
  const swingsAndMisses = events.filter((e) => e.hardHit === 0).length;
  const contactHits = events.length - swingsAndMisses;
  return {
    total: events.length,
    classifiedContacts: events.filter((e) => e.contactType !== null).length,
    classifiedResults: events.filter((e) => e.result !== null).length,
    classifiedHardHits,
    hardHitCount,
    swingsAndMisses,
    contactHits,
    contacts,
    results,
    hardHits,
    byPlayer,
    pitcherHands,
    directions,
    sessions: new Set(events.map((e) => e.sessionId)).size,
  };
}
export function densityBins(
  events: readonly BallEvent[],
  resolution = 12,
): { x: number; y: number; count: number; intensity: number }[] {
  const bins = new Map<string, { x: number; y: number; count: number }>();
  for (const event of events) {
    if (event.hardHit === 0) continue;
    const x = Math.min(resolution - 1, Math.floor(event.fieldX * resolution));
    const y = Math.min(resolution - 1, Math.floor(event.fieldY * resolution));
    const key = `${x}:${y}`;
    const bin = bins.get(key) ?? { x: (x + 0.5) / resolution, y: (y + 0.5) / resolution, count: 0 };
    bin.count++;
    bins.set(key, bin);
  }
  const max = Math.max(1, ...Array.from(bins.values(), (b) => b.count));
  return Array.from(bins.values(), (b) => ({ ...b, intensity: b.count / max }));
}

function cosineInterpolate(a: number, b: number, t: number): number {
  const clampedT = Math.max(0, Math.min(1, t));
  const mu = (1 - Math.cos(clampedT * Math.PI)) / 2;
  return a * (1 - mu) + b * mu;
}

export function getFenceDistanceAtAngle(
  angleDeg: number,
  fenceConfig: OutfieldFenceConfig,
): number {
  const theta = Math.max(-45, Math.min(45, angleDeg));
  if (theta <= -22.5) {
    const t = (theta - -45) / 22.5;
    return cosineInterpolate(fenceConfig.leftLineFeet, fenceConfig.leftCenterFeet, t);
  } else if (theta <= 0) {
    const t = (theta - -22.5) / 22.5;
    return cosineInterpolate(fenceConfig.leftCenterFeet, fenceConfig.centerFeet, t);
  } else if (theta <= 22.5) {
    const t = theta / 22.5;
    return cosineInterpolate(fenceConfig.centerFeet, fenceConfig.rightCenterFeet, t);
  } else {
    const t = (theta - 22.5) / 22.5;
    return cosineInterpolate(fenceConfig.rightCenterFeet, fenceConfig.rightLineFeet, t);
  }
}

// Normalized reference diamond constants
const REF_HOME_X = 0.5;
const REF_HOME_Y = 0.88;
const REF_CF_NORM_RADIUS = 0.8; // 0.88 - 0.08
const REF_POLE_NORM_RADIUS = 0.61659; // sqrt(0.436^2 + 0.436^2)

export function getReferenceScaleAtAngle(angleDeg: number): number {
  const theta = Math.max(-45, Math.min(45, angleDeg));
  const refFeet = getFenceDistanceAtAngle(theta, STANDARD_FENCE_PRESETS.high_school);
  const tNorm = 1 - Math.abs(theta) / 45;
  const refNormRadius = cosineInterpolate(REF_POLE_NORM_RADIUS, REF_CF_NORM_RADIUS, tNorm);
  return refFeet / refNormRadius;
}

export function calculateDistanceFeet(fieldX: number, fieldY: number): number {
  const dx = fieldX - REF_HOME_X;
  const dy = REF_HOME_Y - fieldY;
  const dNorm = Math.sqrt(dx * dx + dy * dy);
  if (dNorm < 0.001) return 0;
  const angleDeg = (Math.atan2(dx, dy) * 180) / Math.PI;
  const scale = getReferenceScaleAtAngle(angleDeg);
  return Math.round(dNorm * scale * 10) / 10;
}

export function isOverTheFence(
  event: Pick<BallEvent, 'fieldX' | 'fieldY' | 'contactType' | 'hardHit'>,
  fenceConfig: OutfieldFenceConfig = STANDARD_FENCE_PRESETS.high_school,
): boolean {
  if (event.hardHit === 0) return false;
  if (event.contactType === 'dribbler' || event.contactType === 'ground-ball') return false;
  const dx = event.fieldX - REF_HOME_X;
  const dy = REF_HOME_Y - event.fieldY;
  const angleDeg = (Math.atan2(dx, dy) * 180) / Math.PI;
  if (Math.abs(angleDeg) > 47.5) return false;
  const dist = calculateDistanceFeet(event.fieldX, event.fieldY);
  const fenceDist = getFenceDistanceAtAngle(angleDeg, fenceConfig);
  return dist >= fenceDist;
}

export function isWarningTrack(
  event: Pick<BallEvent, 'fieldX' | 'fieldY' | 'contactType' | 'hardHit'>,
  fenceConfig: OutfieldFenceConfig = STANDARD_FENCE_PRESETS.high_school,
): boolean {
  if (event.hardHit === 0) return false;
  if (event.contactType === 'dribbler' || event.contactType === 'ground-ball') return false;
  const dx = event.fieldX - REF_HOME_X;
  const dy = REF_HOME_Y - event.fieldY;
  const angleDeg = (Math.atan2(dx, dy) * 180) / Math.PI;
  if (Math.abs(angleDeg) > 47.5) return false;
  const dist = calculateDistanceFeet(event.fieldX, event.fieldY);
  const fenceDist = getFenceDistanceAtAngle(angleDeg, fenceConfig);
  const trackDepth = fenceConfig.warningTrackDepthFeet || 15;
  return dist < fenceDist && dist >= fenceDist - trackDepth;
}

export function generateFenceSvgPath(fenceConfig: OutfieldFenceConfig, offsetFeet = 0): string {
  const points: { x: number; y: number }[] = [];
  const steps = 36; // Every 2.5 degrees from -45 to +45
  for (let i = 0; i <= steps; i++) {
    const angle = -45 + (i * 90) / steps;
    const rad = (angle * Math.PI) / 180;
    const fenceFeet = Math.max(10, getFenceDistanceAtAngle(angle, fenceConfig) + offsetFeet);
    const scale = getReferenceScaleAtAngle(angle);
    const rNorm = fenceFeet / scale;
    const svgX = 500 + rNorm * 1000 * Math.sin(rad);
    const svgY = 880 - rNorm * 1000 * Math.cos(rad);
    points.push({ x: Math.round(svgX * 10) / 10, y: Math.round(svgY * 10) / 10 });
  }
  return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

export function generateWarningTrackSvgPath(fenceConfig: OutfieldFenceConfig): string {
  const steps = 36;
  const outer: { x: number; y: number }[] = [];
  const inner: { x: number; y: number }[] = [];
  const trackDepth = fenceConfig.warningTrackDepthFeet || 15;

  for (let i = 0; i <= steps; i++) {
    const angle = -45 + (i * 90) / steps;
    const rad = (angle * Math.PI) / 180;
    const scale = getReferenceScaleAtAngle(angle);

    const outerFeet = getFenceDistanceAtAngle(angle, fenceConfig);
    const outerRNorm = outerFeet / scale;
    outer.push({
      x: Math.round((500 + outerRNorm * 1000 * Math.sin(rad)) * 10) / 10,
      y: Math.round((880 - outerRNorm * 1000 * Math.cos(rad)) * 10) / 10,
    });

    const innerFeet = Math.max(10, outerFeet - trackDepth);
    const innerRNorm = innerFeet / scale;
    inner.push({
      x: Math.round((500 + innerRNorm * 1000 * Math.sin(rad)) * 10) / 10,
      y: Math.round((880 - innerRNorm * 1000 * Math.cos(rad)) * 10) / 10,
    });
  }

  const outerPath = outer.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const innerPath = inner
    .reverse()
    .map((p) => `L ${p.x} ${p.y}`)
    .join(' ');
  return `${outerPath} ${innerPath} Z`;
}

export function getFenceDistanceMarkers(
  fenceConfig: OutfieldFenceConfig,
): { label: string; x: number; y: number; angle: number }[] {
  const angles = [
    { angle: -45, label: `${fenceConfig.leftLineFeet}'` },
    { angle: -22.5, label: `${fenceConfig.leftCenterFeet}'` },
    { angle: 0, label: `${fenceConfig.centerFeet}'` },
    { angle: 22.5, label: `${fenceConfig.rightCenterFeet}'` },
    { angle: 45, label: `${fenceConfig.rightLineFeet}'` },
  ];
  return angles.map(({ angle, label }) => {
    const rad = (angle * Math.PI) / 180;
    const distFeet = getFenceDistanceAtAngle(angle, fenceConfig);
    const scale = getReferenceScaleAtAngle(angle);
    // Position text label just inside the wall arc for high visibility
    const textRadius = (distFeet - 20) / scale;
    const x = Math.round((500 + textRadius * 1000 * Math.sin(rad)) * 10) / 10;
    const y = Math.round((880 - textRadius * 1000 * Math.cos(rad)) * 10) / 10;
    return { label, x, y, angle };
  });
}

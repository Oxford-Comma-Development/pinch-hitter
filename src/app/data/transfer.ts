import {
  AppSettings,
  BackupData,
  BallEvent,
  CoachNote,
  CONTACT_TYPES,
  Hand,
  HARD_HIT_RATINGS,
  HardHitRating,
  HIT_RESULTS,
  ImportPreview,
  Player,
  PracticeSession,
  RosterPreview,
  RosterRow,
  Team,
} from './models';

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be a valid object.`);
  return value as JsonObject;
}
function string(value: unknown, label: string, required = false): string {
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new Error(`${label} cannot be blank.`);
  return value;
}
function date(value: unknown, label: string): string {
  const text = string(value, label, true);
  if (!Number.isFinite(Date.parse(text)) || !/^\d{4}-\d{2}-\d{2}T/.test(text))
    throw new Error(`${label} must be an ISO date and time.`);
  return new Date(text).toISOString();
}
function number(
  value: unknown,
  label: string,
  minimum = 0,
  maximum = Infinity,
  integer = false,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    (integer && !Number.isInteger(value))
  )
    throw new Error(
      `${label} must be ${integer ? 'a whole number' : 'a number'} from ${minimum}${Number.isFinite(maximum) ? ` to ${maximum}` : ' or greater'}.`,
    );
  return value;
}
function enumeration<T extends string | number | null>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  if (!allowed.includes(value as T)) throw new Error(`${label} has an unsupported value.`);
  return value as T;
}
function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be a list.`);
  const result = value.map((item) => string(item, label, true));
  if (new Set(result).size !== result.length)
    throw new Error(`${label} contains duplicate IDs or values.`);
  return result;
}
function base(value: JsonObject, label: string) {
  return {
    id: string(value['id'], `${label} ID`, true),
    createdAt: date(value['createdAt'], `${label} created time`),
    updatedAt: date(value['updatedAt'], `${label} updated time`),
  };
}
function rotation(value: unknown): number | null {
  return value === null ? null : number(value, 'Rotation contacts', 1, 100, true);
}
function nullableString(value: unknown, label: string): string | null {
  return value === null ? null : string(value, label, true);
}
function rows<T>(
  value: unknown,
  label: string,
  parse: (row: JsonObject) => T & { id: string },
): T[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be a list.`);
  if (value.length > 250_000)
    throw new Error(`${label} exceeds the import limit of 250,000 records.`);
  const records = value.map((row) => parse(object(row, label)));
  const ids = records.map((row) => row.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicate stable IDs.`);
  return records;
}
function parseTeam(row: JsonObject): Team {
  const logoUrl = typeof row['logoUrl'] === 'string' ? row['logoUrl'] : undefined;
  return {
    ...base(row, 'Team'),
    name: string(row['name'], 'Team name', true),
    shortName: string(row['shortName'], 'Team short name'),
    season: string(row['season'], 'Season'),
    notes: string(row['notes'], 'Team notes'),
    ...(logoUrl ? { logoUrl } : {}),
  };
}
function parsePlayer(row: JsonObject): Player {
  if (typeof row['active'] !== 'boolean')
    throw new Error('Player active status must be true or false.');
  return {
    ...base(row, 'Player'),
    teamId: string(row['teamId'], 'Player team ID', true),
    name: string(row['name'], 'Player name', true),
    jerseyNumber: string(row['jerseyNumber'], 'Jersey number'),
    grade: string(row['grade'], 'Grade'),
    bats: enumeration(row['bats'], ['L', 'R', 'S'], 'Bats'),
    throws: enumeration(row['throws'], ['L', 'R', 'S'], 'Throws'),
    positions: strings(row['positions'], 'Positions'),
    notes: string(row['notes'], 'Player notes'),
    active: row['active'],
    order: number(row['order'], 'Roster order', 0, Infinity, true),
  };
}
function parseTurn(row: JsonObject) {
  return {
    queue: strings(row['queue'], 'Batting queue'),
    currentTurn: number(row['currentTurn'], 'Turn sequence', 1, Infinity, true),
    turnContacts: number(row['turnContacts'], 'Turn contact count', 0, Infinity, true),
    nextSequence: number(row['nextSequence'], 'Next event sequence', 1, Infinity, true),
  };
}
function parseSession(row: JsonObject): PracticeSession {
  const undo = row['undoStack'];
  if (!Array.isArray(undo) || undo.length > 100)
    throw new Error('Practice undo history must contain at most 100 captures.');
  return {
    ...base(row, 'Practice'),
    ...parseTurn(row),
    teamId: string(row['teamId'], 'Practice team ID', true),
    startedAt: date(row['startedAt'], 'Practice start'),
    endedAt: row['endedAt'] === null ? null : date(row['endedAt'], 'Practice end'),
    title: string(row['title'], 'Practice title'),
    location: string(row['location'], 'Practice location'),
    notes: string(row['notes'], 'Practice notes'),
    participantIds: strings(row['participantIds'], 'Participants'),
    rotationCount: rotation(row['rotationCount']),
    pitcherHand: enumeration(row['pitcherHand'], ['L', 'R'], 'Practice pitcher hand'),
    undoStack: undo.map((value) => {
      const item = object(value, 'Undo capture');
      return {
        eventId: string(item['eventId'], 'Undo event ID', true),
        before: parseTurn(object(item['before'], 'Before capture')),
        after: parseTurn(object(item['after'], 'After capture')),
      };
    }),
  };
}
function parseEvent(row: JsonObject): BallEvent {
  if (row['schemaVersion'] !== 1 || row['coordinateSystemVersion'] !== 1)
    throw new Error('An observation uses an unsupported schema or coordinate-system version.');
  return {
    ...base(row, 'Observation'),
    schemaVersion: 1,
    coordinateSystemVersion: 1,
    teamId: string(row['teamId'], 'Observation team ID', true),
    playerId: string(row['playerId'], 'Observation player ID', true),
    sessionId: string(row['sessionId'], 'Observation practice ID', true),
    timestamp: date(row['timestamp'], 'Observation timestamp'),
    sequence: number(row['sequence'], 'Observation sequence', 1, Infinity, true),
    turnSequence: number(row['turnSequence'], 'Observation turn', 1, Infinity, true),
    contactSequence: number(row['contactSequence'], 'Contact sequence', 1, Infinity, true),
    fieldX: number(row['fieldX'], 'Field X', 0, 1),
    fieldY: number(row['fieldY'], 'Field Y', 0, 1),
    pitcherHand: enumeration(row['pitcherHand'], ['L', 'R', null], 'Pitcher hand'),
    batterSide: enumeration(row['batterSide'], ['L', 'R', null], 'Batter side'),
    contactType: enumeration(row['contactType'], [...CONTACT_TYPES, null], 'Contact type'),
    result: enumeration(row['result'], [...HIT_RESULTS, null], 'Result'),
    hardHit:
      row['hardHit'] !== undefined && row['hardHit'] !== null
        ? (enumeration(
            row['hardHit'],
            [...HARD_HIT_RATINGS, null],
            'Hard hit',
          ) as HardHitRating | null)
        : null,
    notes: string(row['notes'], 'Observation notes'),
    playerName: string(row['playerName'], 'Player snapshot name'),
    jerseyNumber: string(row['jerseyNumber'], 'Jersey snapshot'),
  };
}
function parseNote(row: JsonObject): CoachNote {
  return {
    ...base(row, 'Note'),
    teamId: string(row['teamId'], 'Note team ID', true),
    playerId: nullableString(row['playerId'], 'Note player ID'),
    sessionId: nullableString(row['sessionId'], 'Note practice ID'),
    eventId: nullableString(row['eventId'], 'Note observation ID'),
    timestamp: date(row['timestamp'], 'Note timestamp'),
    text: string(row['text'], 'Note text', true),
  };
}
function parseSettings(row: JsonObject): AppSettings {
  if (row['id'] !== 'preferences' || typeof row['haptics'] !== 'boolean')
    throw new Error('Settings must include preferences ID and a true/false haptics value.');
  return {
    id: 'preferences',
    activeTeamId: nullableString(row['activeTeamId'], 'Active team ID'),
    defaultPitcherHand: enumeration(row['defaultPitcherHand'], ['L', 'R'], 'Default pitcher hand'),
    rotationCount: rotation(row['rotationCount']),
    haptics: row['haptics'],
    leftHandedMode: typeof row['leftHandedMode'] === 'boolean' ? row['leftHandedMode'] : false,
    colorPalette:
      typeof row['colorPalette'] === 'string' &&
      ['standard', 'colorblind', 'high_contrast'].includes(row['colorPalette'])
        ? (row['colorPalette'] as AppSettings['colorPalette'])
        : 'standard',
    fieldTheme:
      typeof row['fieldTheme'] === 'string' &&
      ['classic', 'high_contrast'].includes(row['fieldTheme'])
        ? (row['fieldTheme'] as AppSettings['fieldTheme'])
        : 'classic',
    shapeMarkers: typeof row['shapeMarkers'] === 'boolean' ? row['shapeMarkers'] : false,
    language:
      typeof row['language'] === 'string' && ['en', 'es'].includes(row['language'])
        ? (row['language'] as AppSettings['language'])
        : 'en',
    updatedAt: date(row['updatedAt'], 'Settings update'),
  };
}
export function validateRelationships(data: BackupData): void {
  const teams = new Set(data.teams.map((t) => t.id));
  const players = new Map(data.players.map((p) => [p.id, p]));
  const sessions = new Map(data.sessions.map((s) => [s.id, s]));
  const events = new Map(data.events.map((e) => [e.id, e]));
  const fail = (message: string): never => {
    throw new Error(`Import integrity check: ${message}`);
  };
  for (const player of data.players)
    if (!teams.has(player.teamId)) fail(`player ${player.name} refers to a missing team.`);
  for (const session of data.sessions) {
    if (!teams.has(session.teamId)) fail('a practice refers to a missing team.');
    if (session.endedAt && Date.parse(session.endedAt) < Date.parse(session.startedAt))
      fail('a practice ends before it starts.');
    for (const id of session.participantIds)
      if (players.get(id)?.teamId !== session.teamId)
        fail('a practice participant is missing or belongs to another team.');
    for (const id of session.queue)
      if (!session.participantIds.includes(id))
        fail('a queued hitter is missing from the practice participants.');
    for (const undo of session.undoStack) {
      if (events.get(undo.eventId)?.sessionId !== session.id)
        fail('an undo entry refers to an observation outside its practice.');
      for (const id of [...undo.before.queue, ...undo.after.queue])
        if (!session.participantIds.includes(id))
          fail('undo history has an invalid practice participant.');
    }
  }
  const sequences = new Set<string>();
  for (const event of data.events) {
    const session = sessions.get(event.sessionId);
    if (
      !teams.has(event.teamId) ||
      players.get(event.playerId)?.teamId !== event.teamId ||
      session?.teamId !== event.teamId ||
      !session.participantIds.includes(event.playerId)
    )
      fail('an observation has missing or inconsistent team, player, or practice links.');
    const sequence = `${event.sessionId}:${event.sequence}`;
    if (sequences.has(sequence))
      fail('two different observations have the same practice sequence.');
    sequences.add(sequence);
  }
  for (const note of data.notes) {
    if (
      !teams.has(note.teamId) ||
      (note.playerId && players.get(note.playerId)?.teamId !== note.teamId) ||
      (note.sessionId && sessions.get(note.sessionId)?.teamId !== note.teamId) ||
      (note.eventId && events.get(note.eventId)?.teamId !== note.teamId)
    )
      fail('a note has missing or inconsistent references.');
    if (note.eventId) {
      const event = events.get(note.eventId)!;
      if (
        (note.playerId && note.playerId !== event.playerId) ||
        (note.sessionId && note.sessionId !== event.sessionId)
      )
        fail('a note does not match its observation.');
    }
  }
  if (data.settings.activeTeamId && !teams.has(data.settings.activeTeamId))
    fail('the active team is missing.');
}
export function parseBackup(text: string): ImportPreview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This is not a valid JSON file. Choose a Pinch Hitter JSON backup.');
  }
  const root = object(parsed, 'Backup');
  if (root['schemaVersion'] !== 1)
    throw new Error(
      `Unsupported backup schema version ${String(root['schemaVersion'])}. This app supports version 1; no data was changed.`,
    );
  if (root['application'] !== 'Pinch Hitter' && root['application'] !== 'Baseball Coach Helper')
    throw new Error('This file is not a Pinch Hitter backup.');
  const data: BackupData = {
    schemaVersion: 1,
    application: 'Pinch Hitter',
    applicationVersion: string(root['applicationVersion'], 'Application version', true),
    exportedAt: date(root['exportedAt'], 'Export timestamp'),
    teams: rows(root['teams'], 'Teams', parseTeam),
    players: rows(root['players'], 'Players', parsePlayer),
    sessions: rows(root['sessions'], 'Practices', parseSession),
    events: rows(root['events'], 'Observations', parseEvent),
    notes: rows(root['notes'], 'Notes', parseNote),
    settings: parseSettings(object(root['settings'], 'Settings')),
  };
  validateRelationships(data);
  const warnings: string[] = [];
  const active = data.sessions.filter((s) => !s.endedAt);
  if (new Set(active.map((s) => s.teamId)).size < active.length)
    warnings.push(
      'This backup contains multiple active practices for a team. The most recently started practice will be shown first.',
    );
  return {
    data,
    counts: {
      teams: data.teams.length,
      players: data.players.length,
      sessions: data.sessions.length,
      events: data.events.length,
      notes: data.notes.length,
    },
    conflicts: 0,
    warnings,
  };
}
export function backupJson(data: BackupData): string {
  return JSON.stringify(data, null, 2);
}
/** Merge never removes a local entity. Timestamp ties keep the local record. */
export function mergeBackups(local: BackupData, incoming: BackupData): BackupData {
  const merge = <T extends { id: string; updatedAt: string }>(
    existing: T[],
    imported: T[],
  ): T[] => {
    const records = new Map(existing.map((record) => [record.id, record]));
    for (const record of imported)
      if (!records.has(record.id) || record.updatedAt > records.get(record.id)!.updatedAt)
        records.set(record.id, record);
    return [...records.values()];
  };
  const data: BackupData = {
    ...local,
    exportedAt: new Date().toISOString(),
    teams: merge(local.teams, incoming.teams),
    players: merge(local.players, incoming.players),
    sessions: merge(local.sessions, incoming.sessions),
    events: merge(local.events, incoming.events),
    notes: merge(local.notes, incoming.notes),
    settings: local.teams.length ? local.settings : incoming.settings,
  };
  const bySession = new Map<string, BallEvent[]>();
  for (const event of data.events) {
    const entries = bySession.get(event.sessionId) ?? [];
    entries.push(event);
    bySession.set(event.sessionId, entries);
  }
  const localSessions = new Set(local.sessions.map((session) => session.id));
  const importedSessions = new Set(incoming.sessions.map((session) => session.id));
  const remapped = new Map<string, BallEvent>();
  data.sessions = data.sessions.map((session) => {
    const events = bySession.get(session.id) ?? [];
    const used = new Set<number>();
    let nextSequence = events.reduce(
      (next, event) => Math.max(next, event.sequence + 1),
      session.nextSequence,
    );
    // Local entries are first. A branched practice appends conflicting incoming sequence numbers while keeping stable IDs and all source coordinates.
    for (const event of events) {
      if (used.has(event.sequence)) {
        const updated = { ...event, sequence: nextSequence++ };
        remapped.set(event.id, updated);
        used.add(updated.sequence);
      } else used.add(event.sequence);
    }
    const shared = localSessions.has(session.id) && importedSessions.has(session.id);
    return {
      ...session,
      nextSequence,
      participantIds: [
        ...new Set([...session.participantIds, ...events.map((event) => event.playerId)]),
      ],
      undoStack: shared ? [] : session.undoStack,
    };
  });
  data.events = data.events.map((event) => remapped.get(event.id) ?? event);
  validateRelationships(data);
  return data;
}
/** RFC 4180 quoting, including newlines and escaped quotation marks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  let closed = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else value += char;
      continue;
    }
    if (char === '"') {
      if (value || closed) throw new Error('A CSV quote must begin a field.');
      quoted = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
      closed = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
      closed = false;
    } else {
      if (closed && char.trim()) throw new Error('Unexpected text after a closing CSV quote.');
      if (!closed) value += char;
    }
  }
  if (quoted) throw new Error('A quoted CSV field is missing its closing quote.');
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}
export function parseRosterCsv(text: string): RosterPreview {
  let csv: string[][];
  try {
    csv = parseCsv(text);
  } catch (error) {
    return { rows: [], errors: [error instanceof Error ? error.message : 'Invalid CSV.'] };
  }
  if (!csv.length) return { rows: [], errors: ['Add at least one player.'] };
  const normalize = (value: string) => value.toLowerCase().replace(/[\s_-]/g, '');
  const first = csv[0].map(normalize);
  const hasHeader = first.some((column) =>
    ['name', 'player', 'playername', 'displayname'].includes(column),
  );
  const headers = hasHeader ? first : ['name', 'number'];
  const lines = hasHeader ? csv.slice(1) : csv;
  const rows: RosterRow[] = [];
  const errors: string[] = [];
  const hand = (value: string): Hand | undefined =>
    (({ left: 'L', right: 'R', switch: 'S', l: 'L', r: 'R', s: 'S' }) as Record<string, Hand>)[
      value.toLowerCase()
    ];
  for (const [index, line] of lines.entries()) {
    const get = (...names: string[]) => {
      const column = headers.findIndex((header) => names.includes(header));
      return column < 0 ? '' : (line[column] ?? '').trim();
    };
    const name = get('name', 'player', 'playername', 'displayname');
    const batsValue = get('bats');
    const throwsValue = get('throws');
    const bats = batsValue ? hand(batsValue) : 'R';
    const throws = throwsValue ? hand(throwsValue) : 'R';
    const rowNumber = index + (hasHeader ? 2 : 1);
    if (!name) {
      errors.push(`Row ${rowNumber}: player name is required.`);
      continue;
    }
    if (!bats || !throws) {
      errors.push(`Row ${rowNumber}: bats and throws must be L, R, S, Left, Right, or Switch.`);
      continue;
    }
    if (!hasHeader && line.length > 2) {
      errors.push(`Row ${rowNumber}: use Name, Number or add a CSV header for more columns.`);
      continue;
    }
    rows.push({
      name,
      jerseyNumber: get('number', 'jerseynumber', 'jersey', '#'),
      bats,
      throws,
      grade: get('grade', 'year'),
      positions: [
        ...new Set(
          get('positions', 'position')
            .split(/[;|]/)
            .map((p) => p.trim())
            .filter(Boolean),
        ),
      ],
    });
  }
  if (!rows.length && !errors.length) errors.push('Add at least one player below the CSV header.');
  return { rows, errors };
}
export const EVENT_CSV_COLUMNS = [
  'event_id',
  'player_id',
  'player_name',
  'jersey_number',
  'team_id',
  'team_name',
  'team_season',
  'session_id',
  'session_date',
  'event_timestamp',
  'pitcher_hand',
  'batter_side',
  'contact_type',
  'result',
  'hard_hit',
  'field_x',
  'field_y',
  'coordinate_system_version',
  'event_sequence',
  'turn_sequence',
  'contact_sequence',
  'notes',
  'created_at',
  'updated_at',
] as const;
/** Prefix spreadsheet formulas in text cells. JSON always retains the exact original text. */
function csvCell(value: string | number | null | undefined): string {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text) && typeof value === 'string') text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function eventsCsv(
  events: readonly BallEvent[],
  teams: readonly Team[],
  sessions: readonly PracticeSession[],
  notes: readonly CoachNote[] = [],
): string {
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const sessionMap = new Map(sessions.map((session) => [session.id, session]));
  const notesByEvent = new Map<string, string[]>();
  for (const note of notes) {
    if (note.eventId) {
      const entries = notesByEvent.get(note.eventId) ?? [];
      entries.push(`[${note.timestamp}] ${note.text}`);
      notesByEvent.set(note.eventId, entries);
    }
  }
  return [
    EVENT_CSV_COLUMNS.join(','),
    ...events.map((event) => {
      const team = teamMap.get(event.teamId);
      const session = sessionMap.get(event.sessionId);
      return [
        event.id,
        event.playerId,
        event.playerName,
        event.jerseyNumber,
        event.teamId,
        team?.name,
        team?.season,
        event.sessionId,
        session?.startedAt,
        event.timestamp,
        event.pitcherHand,
        event.batterSide,
        event.contactType,
        event.result,
        event.hardHit,
        event.fieldX,
        event.fieldY,
        event.coordinateSystemVersion,
        event.sequence,
        event.turnSequence,
        event.contactSequence,
        [event.notes, ...(notesByEvent.get(event.id) ?? [])].filter(Boolean).join('\n'),
        event.createdAt,
        event.updatedAt,
      ]
        .map(csvCell)
        .join(',');
    }),
  ].join('\r\n');
}

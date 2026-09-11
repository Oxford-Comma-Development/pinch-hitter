import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachStore } from './coach-store';
import {
  CoachRepository,
  ConcurrentWriteError,
  DatabaseChange,
  DatabaseSnapshot,
} from './repository';
import {
  backupJson,
  eventsCsv,
  mergeBackups,
  parseBackup,
  parseCsv,
  parseRosterCsv,
} from './transfer';

let disk: DatabaseSnapshot;
let store: CoachStore;
let commits: DatabaseChange[][];
let rejectNext: boolean;
beforeEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear();

  disk = { teams: [], players: [], sessions: [], events: [], notes: [], settings: [] };
  commits = [];
  rejectNext = false;

  vi.spyOn(CoachRepository.prototype, 'load').mockImplementation(async () => structuredClone(disk));
  vi.spyOn(CoachRepository.prototype, 'hasChanges').mockResolvedValue(false);
  vi.spyOn(CoachRepository.prototype, 'apply').mockImplementation(async (changes, clear) => {
    if (rejectNext) {
      rejectNext = false;
      throw new Error('Storage full');
    }
    commits.push(structuredClone(changes));
    if (clear) disk = { teams: [], players: [], sessions: [], events: [], notes: [], settings: [] };
    for (const change of changes) {
      const records = new Map(disk[change.table].map((record) => [record.id, record]));
      for (const id of change.delete ?? []) records.delete(id);
      for (const record of change.put ?? []) records.set(record.id, structuredClone(record));
      (disk[change.table] as unknown[]) = [...records.values()];
    }
  });
  store = new CoachStore();
});
afterEach(() => vi.restoreAllMocks());
async function setup(rotationCount: number | null = null) {
  await store.init();
  await store.addTeam({ name: 'Falcons', shortName: 'FAL', season: '2026' });
  const marcus = await store.addPlayer({ name: 'Marcus', jerseyNumber: '12', bats: 'R' });
  const tyler = await store.addPlayer({ name: 'Tyler', jerseyNumber: '7', bats: 'L' });
  const james = await store.addPlayer({ name: 'James', jerseyNumber: '3', bats: 'S' });
  await store.startSession({ rotationCount });
  return { marcus, tyler, james };
}
describe('CoachStore persistence boundary', () => {
  it('rejects a capture when another window changed the hitter the coach was shown', async () => {
    const { marcus, tyler } = await setup();
    const current = disk.sessions[0];
    disk.sessions[0] = {
      ...current,
      queue: [tyler.id, ...current.queue.filter((id) => id !== tyler.id)],
    };
    vi.mocked(CoachRepository.prototype.hasChanges).mockResolvedValueOnce(true);
    const count = commits.length;
    await expect(store.recordContact(0.4, 0.3, 'R', marcus.id)).rejects.toThrow(
      'current hitter changed',
    );
    expect(store.events()).toHaveLength(0);
    expect(disk.events).toHaveLength(0);
    expect(commits).toHaveLength(count);
    expect(store.activeSession()?.queue[0]).toBe(tyler.id);
    const event = await store.recordContact(0.4, 0.3, 'L', tyler.id);
    expect(event).toMatchObject({ playerId: tyler.id, batterSide: 'L' });
  });
  it('validates every timestamped note before committing any event correction', async () => {
    await setup();
    const event = await store.recordContact(0.3, 0.4);
    const note = await store.addNote({ eventId: event.id }, 'Keep your hands back');
    const count = commits.length;
    await expect(
      store.updateEvent(event.id, { fieldX: 0.8, result: 'double' }, [
        { id: note.id, text: '   ' },
      ]),
    ).rejects.toThrow('cannot be blank');
    expect(commits).toHaveLength(count);
    expect(store.events()[0]).toEqual(event);
    expect(disk.events[0]).toEqual(event);
    expect(store.notes()[0]).toEqual(note);
  });
  it('saves event corrections and timestamped notes atomically, preserving both when storage fails', async () => {
    await setup();
    const event = await store.recordContact(0.3, 0.4);
    const note = await store.addNote({ eventId: event.id }, 'Original note');
    rejectNext = true;
    await expect(
      store.updateEvent(event.id, { fieldX: 0.8 }, [{ id: note.id, text: 'Corrected note' }]),
    ).rejects.toThrow('Storage full');
    expect(store.events()[0]).toEqual(event);
    expect(store.notes()[0]).toEqual(note);
    expect(disk.events[0]).toEqual(event);
    expect(disk.notes[0]).toEqual(note);
    await store.updateEvent(event.id, { fieldX: 0.8 }, [{ id: note.id, text: 'Corrected note' }]);
    expect(commits.at(-1)?.map((change) => change.table)).toEqual(['events', 'notes']);
    expect(store.events()[0].fieldX).toBe(0.8);
    expect(store.notes()[0].text).toBe('Corrected note');
  });
  it('rejects edits to a note attached to a different observation', async () => {
    await setup();
    const first = await store.recordContact(0.2, 0.2);
    const second = await store.recordContact(0.3, 0.3);
    const note = await store.addNote({ eventId: second.id }, 'Second contact');
    await expect(
      store.updateEvent(first.id, { result: 'out' }, [{ id: note.id, text: 'Wrong event' }]),
    ).rejects.toThrow('no longer belongs');
    expect(store.events()[0].result).toBeNull();
    expect(store.notes()[0].text).toBe('Second contact');
  });
  it('retries a concurrent-tab transaction conflict without duplicating the observation', async () => {
    await setup();
    vi.mocked(CoachRepository.prototype.apply).mockRejectedValueOnce(new ConcurrentWriteError());
    await store.recordContact(0.4, 0.3);
    expect(store.events()).toHaveLength(1);
    expect(store.events()[0].sequence).toBe(1);
    expect(store.activeSession()?.turnContacts).toBe(1);
  });
  it('keeps undo turn counts correct after deleting an earlier contact in history', async () => {
    await setup();
    const first = await store.recordContact(0.2, 0.2);
    await store.recordContact(0.3, 0.3);
    await store.recordContact(0.4, 0.4);
    await store.deleteEvent(first.id);
    expect(store.activeSession()?.turnContacts).toBe(2);
    await store.undoLast();
    expect(store.activeSession()?.turnContacts).toBe(1);
    expect(store.events()).toHaveLength(1);
    await store.undoLast();
    expect(store.activeSession()?.turnContacts).toBe(0);
  });
  it('commits a contact and its queue state atomically and reloads the active practice', async () => {
    const { tyler } = await setup(1);
    const event = await store.recordContact(0.3, 0.4);
    expect(commits.at(-1)?.map((change) => change.table)).toEqual(['events', 'sessions']);
    const reopened = new CoachStore();
    await reopened.init();
    expect(reopened.events()[0]).toEqual(event);
    expect(reopened.activeSession()?.queue[0]).toBe(tyler.id);
    expect(reopened.activeSession()?.undoStack[0].eventId).toBe(event.id);
    await reopened.undoLast();
    expect(reopened.events()).toHaveLength(0);
    expect(reopened.activeSession()?.turnContacts).toBe(0);
  });
  it('keeps UI and persisted queue unchanged if saving the event fails', async () => {
    await setup(1);
    const before = structuredClone(store.activeSession());
    rejectNext = true;
    await expect(store.recordContact(0.5, 0.5)).rejects.toThrow('Storage full');
    expect(store.events()).toEqual([]);
    expect(store.activeSession()).toEqual(before);
    expect(store.error()).toBe('Storage full');
    await store.recordContact(0.5, 0.5);
    expect(store.events()).toHaveLength(1);
  });
  it('serializes rapid contacts without reusing event sequence or losing turn count', async () => {
    await setup();
    await Promise.all(Array.from({ length: 5 }, (_, i) => store.recordContact(i / 10, 0.2)));
    expect(store.events().map((e) => e.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(store.activeSession()?.turnContacts).toBe(5);
  });
  it('retains pitcher hand across hitters and enriches only the requested event', async () => {
    await setup();
    await store.setPitcherHand('L');
    const first = await store.recordContact(0.3, 0.2);
    await store.enrichEvent(first.id, { contactType: 'line-drive', result: 'double' });
    await store.nextBatter();
    const second = await store.recordContact(0.7, 0.4);
    expect(second).toMatchObject({
      pitcherHand: 'L',
      batterSide: 'L',
      contactType: null,
      result: null,
    });
    expect(store.events()[0]).toMatchObject({ contactType: 'line-drive', result: 'double' });
  });
  it('persists queue deferral, touch reorder, removal, return, and direct selection', async () => {
    const { marcus, tyler, james } = await setup();
    await store.deferBatter(tyler.id);
    expect(store.activeSession()?.queue).toEqual([marcus.id, james.id, tyler.id]);
    await store.reorderQueue([tyler.id, james.id]);
    await store.removeFromQueue(tyler.id);
    await store.returnToQueue(tyler.id);
    await store.selectBatter(james.id);
    const reopened = new CoachStore();
    await reopened.init();
    expect(reopened.activeSession()?.queue).toEqual([james.id, tyler.id, marcus.id]);
  });
  it('archives players without altering historical data or changing another team', async () => {
    const { marcus } = await setup();
    const teamId = store.activeTeam()!.id;
    await store.recordContact(0.3, 0.4);
    await store.updatePlayer(marcus.id, { active: false });
    expect(store.roster()).toHaveLength(2);
    await store.addTeam({ name: 'Owls' });
    expect(store.roster()).toHaveLength(0);
    expect(store.events()).toHaveLength(1);
    await store.setActiveTeam(teamId);
    expect(store.activeSession()).not.toBeNull();
  });
  it('edits history without reopening a completed session and deletes scoped notes', async () => {
    await setup();
    const event = await store.recordContact(0.3, 0.4);
    await store.addNote({ eventId: event.id }, 'Stay through it');
    await store.finishSession();
    await store.updateEvent(event.id, { fieldX: 0.7, result: 'single' });
    expect(store.activeSession()).toBeNull();
    expect(store.events()[0].fieldX).toBe(0.7);
    await store.deleteEvent(event.id);
    expect(store.notes()).toEqual([]);
  });
  it('reloads a different tab revision before making its next queue decision', async () => {
    const { tyler } = await setup();
    const session = disk.sessions[0];
    disk.sessions[0] = {
      ...session,
      queue: [tyler.id, ...session.queue.filter((id) => id !== tyler.id)],
    };
    vi.mocked(CoachRepository.prototype.hasChanges).mockResolvedValueOnce(true);
    const event = await store.recordContact(0.5, 0.4);
    expect(event.playerId).toBe(tyler.id);
  });
  it('updates and persists leftHandedMode in preferences', async () => {
    await setup();
    expect(store.settings().leftHandedMode).toBe(false);
    await store.updateSettings({ leftHandedMode: true });
    expect(store.settings().leftHandedMode).toBe(true);
    await store.updateSettings({ leftHandedMode: false });
    expect(store.settings().leftHandedMode).toBe(false);
  });
});

describe('portable backups and CSV', () => {
  it('refreshes a stale tab before exporting without writing any domain records', async () => {
    await setup();
    const otherWindow = new CoachStore();
    await otherWindow.init();
    const event = await otherWindow.recordContact(0.4, 0.2);
    expect(store.events()).toHaveLength(0);
    vi.mocked(CoachRepository.prototype.hasChanges).mockResolvedValueOnce(true);
    const count = commits.length;
    const backup = await store.exportFreshBackup();
    expect(backup.events).toEqual([event]);
    expect(backup.sessions[0].turnContacts).toBe(1);
    expect(commits).toHaveLength(count);
    disk.teams[0] = { ...disk.teams[0], name: 'Updated in another window' };
    vi.mocked(CoachRepository.prototype.hasChanges).mockResolvedValueOnce(true);
    await store.refresh();
    expect(store.activeTeam()?.name).toBe('Updated in another window');
    expect(commits).toHaveLength(count);
  });
  it('waits for pending captures before creating a complete export snapshot', async () => {
    await setup();
    const contact = store.recordContact(0.2, 0.3);
    const backup = await store.exportFreshBackup();
    const event = await contact;
    expect(backup.events).toEqual([event]);
    expect(backup.sessions[0].turnContacts).toBe(1);
  });
  it('round-trips all entities, notes, event context, settings, and resume state through JSON', async () => {
    const { marcus } = await setup(3);
    await store.recordContact(0.2, 0.3);
    await store.addNote({ playerId: marcus.id }, 'Work on outside pitches');
    const backup = store.exportBackup();
    const preview = parseBackup(backupJson(backup));
    expect(preview.counts).toEqual({ teams: 1, players: 3, sessions: 1, events: 1, notes: 1 });
    expect(preview.data).toEqual(backup);
    await store.clearAll();
    await store.importBackup(preview);
    expect(store.activeSession()?.turnContacts).toBe(1);
    expect(store.notes()[0].text).toBe('Work on outside pitches');
    expect(store.roster()).toHaveLength(3);
  });
  it('merges stable IDs without duplicating records and retains records absent from backup', async () => {
    await setup();
    await store.recordContact(0.2, 0.3);
    const backup = backupJson(store.exportBackup());
    await store.addPlayer({ name: 'Noah' });
    await store.importBackup(store.previewImport(backup));
    expect(store.players()).toHaveLength(4);
    expect(store.events()).toHaveLength(1);
    expect(store.activeSession()?.undoStack).toEqual([]);
  });
  it('merges branched practice contacts without loss or duplicate session sequence', async () => {
    await setup();
    const original = await store.recordContact(0.2, 0.3);
    const local = store.exportBackup();
    const branch = structuredClone(local);
    branch.events[0] = { ...original, id: 'independent-branch-contact', fieldX: 0.8 };
    branch.sessions[0].undoStack = [];
    const merged = mergeBackups(local, branch);
    expect(merged.events).toHaveLength(2);
    expect(merged.events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(merged.events[1].fieldX).toBe(0.8);
    expect(merged.sessions[0].nextSequence).toBe(3);
    expect(merged.sessions[0].undoStack).toEqual([]);
    expect(parseBackup(backupJson(merged)).counts.events).toBe(2);
  });
  it('rejects unknown schema, malformed coordinates, duplicate IDs, and dangling links before writes', async () => {
    await setup();
    await store.recordContact(0.2, 0.3);
    const data = store.exportBackup();
    const saved = commits.length;
    expect(data.application).toBe('Pinch Hitter');
    const legacyParsed = parseBackup(
      JSON.stringify({ ...data, application: 'Baseball Coach Helper' }),
    );
    expect(legacyParsed.data.application).toBe('Pinch Hitter');
    const pinchHitterParsed = parseBackup(JSON.stringify(data));
    expect(pinchHitterParsed.data.application).toBe('Pinch Hitter');
    expect(() => parseBackup(JSON.stringify({ ...data, application: 'Other App' }))).toThrow(
      'not a Pinch Hitter backup',
    );
    expect(() => parseBackup(JSON.stringify({ ...data, schemaVersion: 99 }))).toThrow('version');
    expect(() =>
      parseBackup(JSON.stringify({ ...data, events: [{ ...data.events[0], fieldX: 2 }] })),
    ).toThrow('Field X');
    expect(() =>
      parseBackup(JSON.stringify({ ...data, players: [...data.players, data.players[0]] })),
    ).toThrow('duplicate');
    expect(() => parseBackup(JSON.stringify({ ...data, players: [] }))).toThrow('participant');
    expect(commits).toHaveLength(saved);
  });
  it('validates the merged graph when individually valid records would conflict with local references', async () => {
    await setup();
    const local = store.exportBackup();
    const incoming = structuredClone(local);
    incoming.teams.push({ ...local.teams[0], id: 'another-team' });
    incoming.players[0].teamId = 'another-team';
    incoming.players[0].updatedAt = '2030-01-01T00:00:00.000Z';
    incoming.sessions = [];
    expect(() => mergeBackups(local, incoming)).toThrow('participant');
  });
  it('exports stable CSV columns with precise coordinates, quoting, newlines, and formula-safe text', async () => {
    await setup();
    const event = await store.recordContact(0.123456, 0.654321);
    await store.updateEvent(event.id, { notes: '=SUM(1,2)\nCoach said "good"' });
    const csv = eventsCsv(store.events(), store.teams(), store.sessions());
    const parsed = parseCsv(csv);
    const header = parsed[0];
    const values = parsed[1];
    expect(values[header.indexOf('field_x')]).toBe('0.123456');
    expect(values[header.indexOf('notes')]).toBe('\'=SUM(1,2)\nCoach said "good"');
    expect(header).toContain('coordinate_system_version');
    expect(values[header.indexOf('contact_type')]).toBe('');
  });
  it('previews header-based roster CSV in any column order and supports quoted names and bulk lines', () => {
    expect(
      parseRosterCsv('number,name,bats,throws,positions\n12,"James, Jr.",Switch,R,SS;2B').rows[0],
    ).toEqual({
      name: 'James, Jr.',
      jerseyNumber: '12',
      bats: 'S',
      throws: 'R',
      grade: '',
      positions: ['SS', '2B'],
    });
    expect(parseRosterCsv('Marcus,12\nTyler,7').rows).toHaveLength(2);
    expect(parseRosterCsv('name,bats\nMarcus,maybe').errors[0]).toContain('Row 2');
    expect(parseRosterCsv('"unclosed').errors).toHaveLength(1);
  });
  it('records swings and misses (whiff) at home plate with hardHit: 0 and null result', async () => {
    const { marcus } = await setup();
    const event = await store.recordSwingAndMiss('R', marcus.id);
    expect(event).toMatchObject({
      fieldX: 0.5,
      fieldY: 0.88,
      hardHit: 0,
      contactType: null,
      result: null,
      playerId: marcus.id,
    });
    expect(store.events()).toHaveLength(1);
    expect(disk.events).toHaveLength(1);
    expect(disk.events[0].hardHit).toBe(0);
    expect(disk.events[0].result).toBeNull();

    // Can enrich hardHit rating
    await store.enrichEvent(event.id, { hardHit: 1 });
    expect(store.events()[0].hardHit).toBe(1);
    expect(disk.events[0].hardHit).toBe(1);
  });
  it('moves events to another player', async () => {
    const { marcus, tyler } = await setup();
    const ev1 = await store.recordContact(0.4, 0.4, 'R', marcus.id);
    const ev2 = await store.recordContact(0.6, 0.6, 'R', marcus.id);

    expect(store.events().filter((e) => e.playerId === marcus.id)).toHaveLength(2);
    expect(store.events().filter((e) => e.playerId === tyler.id)).toHaveLength(0);

    // Single move via updateEvent
    await store.updateEvent(ev1.id, { playerId: tyler.id });
    expect(store.events().find((e) => e.id === ev1.id)?.playerId).toBe(tyler.id);

    // Batch move via moveEvents
    await store.moveEvents([ev2.id], tyler.id);
    expect(store.events().filter((e) => e.playerId === tyler.id)).toHaveLength(2);
    expect(store.events().filter((e) => e.playerId === marcus.id)).toHaveLength(0);
  });
  it('mass deletes events and removes associated notes', async () => {
    const { marcus } = await setup();
    const ev1 = await store.recordContact(0.4, 0.4, 'R', marcus.id);
    const ev2 = await store.recordContact(0.6, 0.6, 'R', marcus.id);
    await store.addNote({ eventId: ev1.id }, 'Note on hit 1');

    expect(store.events()).toHaveLength(2);
    expect(store.notes().filter((n) => n.eventId === ev1.id)).toHaveLength(1);

    await store.deleteEvents([ev1.id, ev2.id]);
    expect(store.events()).toHaveLength(0);
    expect(store.notes().filter((n) => n.eventId === ev1.id)).toHaveLength(0);
  });
  it('cascades practice session deletion across sessions, events, and notes', async () => {
    await setup();
    const event = await store.recordContact(0.4, 0.4);
    const session = store.activeSession()!;
    await store.addNote({ sessionId: session.id }, 'Session note');
    await store.addNote({ eventId: event.id }, 'Event note');

    expect(store.sessions()).toHaveLength(1);
    expect(store.events()).toHaveLength(1);
    expect(store.notes()).toHaveLength(2);

    await store.deleteSession(session.id);

    expect(store.sessions()).toHaveLength(0);
    expect(store.events()).toHaveLength(0);
    expect(store.notes()).toHaveLength(0);
    expect(disk.sessions).toHaveLength(0);
    expect(disk.events).toHaveLength(0);
    expect(disk.notes).toHaveLength(0);
  });
  it('maintains backward compatibility for older backup imports without hardHit', async () => {
    await setup();
    await store.recordContact(0.3, 0.5);
    const backup = store.exportBackup();
    // Simulate older backup without hardHit property on events
    const olderEvent = { ...backup.events[0] } as Record<string, unknown>;
    delete olderEvent['hardHit'];
    const olderBackupJson = JSON.stringify({
      ...backup,
      events: [olderEvent],
    });

    const parsed = parseBackup(olderBackupJson);
    expect(parsed.data.events[0].hardHit).toBeNull();
  });
  it('tracks lastBackupAt locally and flags substantial unbacked work', async () => {
    await setup();
    // Before any backup, we have a session and player
    expect(store.lastBackupAt()).toBeNull();
    expect(store.unbackedWork().hasSubstantialWork).toBe(true);

    // Record a backup
    store.recordBackupExported();
    expect(store.lastBackupAt()).toBeTruthy();
    expect(store.unbackedWork().hasSubstantialWork).toBe(false);

    // Simulate backup was in the past and new work is recorded
    store.recordBackupExported('2026-01-01T00:00:00.000Z');
    await store.recordContact(0.3, 0.5);
    await store.recordContact(0.4, 0.5);
    await store.recordContact(0.5, 0.5);
    expect(store.unbackedWork().hasSubstantialWork).toBe(true);
    expect(store.unbackedWork().unbackedEvents).toBe(3);
    expect(store.unbackedWork().summary).toContain(
      '3 new contacts recorded since your last backup',
    );

    // Exporting again clears the unbacked flag
    store.recordBackupExported();
    expect(store.unbackedWork().hasSubstantialWork).toBe(false);

    // Clearing data clears lastBackupAt
    await store.clearAll();
    expect(store.lastBackupAt()).toBeNull();
  });
  it('updates and persists visual accessibility settings in coach store', async () => {
    await setup();
    expect(store.settings().colorPalette).toBe('standard');
    expect(store.settings().fieldTheme).toBe('classic');
    expect(store.settings().shapeMarkers).toBe(false);

    await store.updateSettings({
      colorPalette: 'colorblind',
      fieldTheme: 'high_contrast',
      shapeMarkers: true,
      leftHandedMode: true,
    });

    expect(store.settings().colorPalette).toBe('colorblind');
    expect(store.settings().fieldTheme).toBe('high_contrast');
    expect(store.settings().shapeMarkers).toBe(true);
    expect(store.settings().leftHandedMode).toBe(true);

    const backup = store.exportBackup();
    const preview = parseBackup(backupJson(backup));
    expect(preview.data.settings.colorPalette).toBe('colorblind');
    expect(preview.data.settings.fieldTheme).toBe('high_contrast');
    expect(preview.data.settings.shapeMarkers).toBe(true);
    expect(preview.data.settings.leftHandedMode).toBe(true);
  });
});

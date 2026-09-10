import { computed, Injectable, signal } from '@angular/core';
import {
  advanceTurn,
  assertCoordinates,
  createContact,
  deferQueue,
  jumpQueue,
  reorderUpcoming,
  undoContact,
} from './domain';
import {
  AppSettings,
  APP_VERSION,
  BackupData,
  BallEvent,
  BatterSide,
  CoachNote,
  CONTACT_TYPES,
  ContactType,
  defaultSettings,
  HARD_HIT_RATINGS,
  HardHitRating,
  HIT_RESULTS,
  HitResult,
  ImportPreview,
  Player,
  PracticeSession,
  RosterRow,
  Team,
} from './models';
import {
  CoachRepository,
  ConcurrentWriteError,
  DatabaseChange,
  DatabaseRecords,
  DatabaseSnapshot,
  TableName,
} from './repository';
import { mergeBackups, parseBackup } from './transfer';

type TeamInput = Pick<Team, 'name'> & Partial<Pick<Team, 'shortName' | 'season' | 'notes'>>;
type PlayerInput = Pick<Player, 'name'> &
  Partial<Omit<Player, 'id' | 'createdAt' | 'updatedAt' | 'name'>>;
export interface SessionOptions {
  playerIds?: string[];
  title?: string;
  location?: string;
  notes?: string;
  rotationCount?: number | null;
}
const now = () => new Date().toISOString();
const entity = () => ({ id: crypto.randomUUID(), createdAt: now(), updatedAt: now() });
function requireName(name: string): string {
  if (!name?.trim()) throw new Error('Enter a name.');
  return name.trim();
}
function requireRotation(value: number | null): void {
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 100))
    throw new Error('Automatic rotation must be between 1 and 100 recorded contacts.');
}

@Injectable({ providedIn: 'root' })
export class CoachStore {
  readonly teams = signal<Team[]>([]);
  readonly players = signal<Player[]>([]);
  readonly sessions = signal<PracticeSession[]>([]);
  readonly events = signal<BallEvent[]>([]);
  readonly notes = signal<CoachNote[]>([]);
  readonly settings = signal<AppSettings>(defaultSettings());
  readonly ready = signal(false);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly activeTeam = computed(
    () => this.teams().find((team) => team.id === this.settings().activeTeamId) ?? null,
  );
  readonly roster = computed(() =>
    this.players()
      .filter((player) => player.teamId === this.settings().activeTeamId && player.active)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
  );
  readonly activeSession = computed(
    () =>
      this.sessions()
        .filter((session) => session.teamId === this.settings().activeTeamId && !session.endedAt)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null,
  );
  private readonly repository = new CoachRepository();
  private initialization: Promise<void> | null = null;
  private pending: Promise<unknown> = Promise.resolve();

  init(): Promise<void> {
    this.initialization ??= this.repository
      .load()
      .then((data) => {
        this.applySnapshot(data);
        this.ready.set(true);
      })
      .catch((error: unknown) => {
        this.error.set(error instanceof Error ? error.message : 'Local data could not be opened.');
        this.initialization = null;
        throw error;
      });
    return this.initialization;
  }

  private applySnapshot(data: DatabaseSnapshot): void {
    this.teams.set(data.teams);
    this.players.set(data.players);
    this.sessions.set(data.sessions);
    this.events.set(data.events);
    this.notes.set(data.notes);
    this.settings.set(
      data.settings[0] ?? { ...defaultSettings(), activeTeamId: data.teams[0]?.id ?? null },
    );
  }

  private write<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.pending.then(async () => {
      await this.init();
      this.saving.set(true);
      this.error.set('');
      try {
        const run = async () => {
          for (let attempt = 0; ; attempt++) {
            if (await this.repository.hasChanges())
              this.applySnapshot(await this.repository.load());
            try {
              return await operation();
            } catch (error) {
              if (!(error instanceof ConcurrentWriteError) || attempt >= 2) throw error;
            }
          }
        };
        // Web Locks serialize read/modify/write across tabs. The tiny revision record avoids reloading a season on each tap.
        return typeof navigator !== 'undefined' && navigator.locks
          ? await navigator.locks.request('pinch-hitter-write', run)
          : await run();
      } finally {
        this.saving.set(false);
      }
    });
    this.pending = task.catch((error: unknown) => {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'This change could not be saved. Try exporting a backup and freeing device storage.',
      );
    });
    return task;
  }
  private async commit(changes: DatabaseChange[], clear = false): Promise<void> {
    await this.repository.apply(changes, clear);
    if (clear) {
      this.teams.set([]);
      this.players.set([]);
      this.sessions.set([]);
      this.events.set([]);
      this.notes.set([]);
      this.settings.set(defaultSettings());
    }
    for (const change of changes) {
      if (change.table === 'settings') {
        if (change.put?.length) this.settings.set(change.put[0] as AppSettings);
        continue;
      }
      const collection = this[change.table];
      const updated = new Map<string, DatabaseRecords[TableName]>(
        collection().map((item) => [item.id, item]),
      );
      for (const id of change.delete ?? []) updated.delete(id);
      for (const record of change.put ?? []) updated.set(record.id, record);
      // Every table's discriminant is checked at the repository boundary above.
      (collection as { set: (value: DatabaseRecords[TableName][]) => void }).set([
        ...updated.values(),
      ]);
    }
  }
  private session(): PracticeSession {
    const session = this.activeSession();
    if (!session) throw new Error('Start or resume a practice first.');
    return session;
  }
  private async saveSession(session: PracticeSession): Promise<PracticeSession> {
    const updated = { ...session, updatedAt: now() };
    await this.commit([{ table: 'sessions', put: [updated] }]);
    return updated;
  }

  addTeam(input: TeamInput): Promise<Team> {
    return this.write(async () => {
      const team: Team = {
        ...entity(),
        name: requireName(input.name),
        shortName: input.shortName?.trim() ?? '',
        season: input.season?.trim() ?? '',
        notes: input.notes ?? '',
      };
      await this.commit([
        { table: 'teams', put: [team] },
        {
          table: 'settings',
          put: [{ ...this.settings(), activeTeamId: team.id, updatedAt: now() }],
        },
      ]);
      return team;
    });
  }
  updateTeam(id: string, patch: Partial<Team>): Promise<Team> {
    return this.write(async () => {
      const existing = this.teams().find((team) => team.id === id);
      if (!existing) throw new Error('Team not found.');
      const team = {
        ...existing,
        ...patch,
        name: requireName(patch.name ?? existing.name),
        id,
        createdAt: existing.createdAt,
        updatedAt: now(),
      };
      await this.commit([{ table: 'teams', put: [team] }]);
      return team;
    });
  }
  setActiveTeam(id: string): Promise<void> {
    return this.write(async () => {
      if (!this.teams().some((team) => team.id === id)) throw new Error('Team not found.');
      await this.commit([
        { table: 'settings', put: [{ ...this.settings(), activeTeamId: id, updatedAt: now() }] },
      ]);
    });
  }
  addPlayer(input: PlayerInput): Promise<Player> {
    return this.write(async () => {
      const teamId = input.teamId ?? this.settings().activeTeamId;
      if (!teamId || !this.teams().some((team) => team.id === teamId))
        throw new Error('Create a team first.');
      const player = this.makePlayer(
        input,
        teamId,
        this.players().filter((p) => p.teamId === teamId).length,
      );
      await this.commit([{ table: 'players', put: [player] }]);
      return player;
    });
  }
  private makePlayer(input: PlayerInput, teamId: string, order: number): Player {
    return {
      ...entity(),
      teamId,
      name: requireName(input.name),
      jerseyNumber: input.jerseyNumber?.trim() ?? '',
      grade: input.grade ?? '',
      bats: input.bats ?? 'R',
      throws: input.throws ?? 'R',
      positions: input.positions ?? [],
      notes: input.notes ?? '',
      active: input.active ?? true,
      order: input.order ?? order,
    };
  }
  updatePlayer(id: string, patch: Partial<Player>): Promise<Player> {
    return this.write(async () => {
      const existing = this.players().find((player) => player.id === id);
      if (!existing) throw new Error('Player not found.');
      const player = {
        ...existing,
        ...patch,
        name: requireName(patch.name ?? existing.name),
        id,
        teamId: existing.teamId,
        createdAt: existing.createdAt,
        updatedAt: now(),
      };
      await this.commit([{ table: 'players', put: [player] }]);
      return player;
    });
  }
  reorderRoster(ids: string[]): Promise<void> {
    return this.write(async () => {
      const roster = this.roster();
      if (
        new Set(ids).size !== roster.length ||
        ids.length !== roster.length ||
        ids.some((id) => !roster.some((p) => p.id === id))
      )
        throw new Error('The order must contain each active player once.');
      await this.commit([
        {
          table: 'players',
          put: ids.map((id, order) => ({
            ...roster.find((p) => p.id === id)!,
            order,
            updatedAt: now(),
          })),
        },
      ]);
    });
  }
  importRoster(rows: RosterRow[], teamId?: string): Promise<Player[]> {
    return this.write(async () => {
      const target = teamId ?? this.settings().activeTeamId;
      if (!target || !this.teams().some((t) => t.id === target))
        throw new Error('Create a team first.');
      const offset = this.players().filter((p) => p.teamId === target).length;
      const players = rows.map((row, index) => this.makePlayer(row, target, offset + index));
      await this.commit([{ table: 'players', put: players }]);
      return players;
    });
  }
  startSession(options: SessionOptions = {}): Promise<PracticeSession> {
    return this.write(async () => {
      if (this.activeSession()) return this.activeSession()!;
      const teamId = this.settings().activeTeamId;
      if (!teamId) throw new Error('Create a team first.');
      const ids = options.playerIds ?? this.roster().map((p) => p.id);
      if (
        !ids.length ||
        new Set(ids).size !== ids.length ||
        ids.some(
          (id) => !this.players().some((p) => p.id === id && p.teamId === teamId && p.active),
        )
      )
        throw new Error('Choose at least one active roster player, without duplicates.');
      const rotationCount =
        options.rotationCount === undefined ? this.settings().rotationCount : options.rotationCount;
      requireRotation(rotationCount);
      const session: PracticeSession = {
        ...entity(),
        teamId,
        title: options.title?.trim() || 'Batting practice',
        location: options.location?.trim() ?? '',
        notes: options.notes ?? '',
        startedAt: now(),
        endedAt: null,
        participantIds: [...ids],
        queue: [...ids],
        rotationCount,
        pitcherHand: this.settings().defaultPitcherHand,
        currentTurn: 1,
        turnContacts: 0,
        nextSequence: 1,
        undoStack: [],
      };
      return this.saveSession(session);
    });
  }
  finishSession(id?: string): Promise<PracticeSession> {
    return this.write(async () => {
      const session = id ? this.sessions().find((s) => s.id === id) : this.session();
      if (!session) throw new Error('Practice not found.');
      return this.saveSession({ ...session, endedAt: now() });
    });
  }
  resumeSession(id: string): Promise<PracticeSession> {
    return this.write(async () => {
      const session = this.sessions().find((s) => s.id === id);
      if (!session) throw new Error('Practice not found.');
      const other = this.sessions().find(
        (s) => s.teamId === session.teamId && !s.endedAt && s.id !== id,
      );
      if (other) throw new Error('Finish the current practice before resuming another.');
      const updated = { ...session, endedAt: null, updatedAt: now() };
      await this.commit([
        { table: 'sessions', put: [updated] },
        {
          table: 'settings',
          put: [{ ...this.settings(), activeTeamId: session.teamId, updatedAt: now() }],
        },
      ]);
      return updated;
    });
  }
  updateSession(
    id: string,
    patch: Partial<
      Pick<PracticeSession, 'title' | 'location' | 'notes' | 'pitcherHand' | 'rotationCount'>
    >,
  ): Promise<PracticeSession> {
    return this.write(async () => {
      const session = this.sessions().find((s) => s.id === id);
      if (!session) throw new Error('Practice not found.');
      if (patch.rotationCount !== undefined) requireRotation(patch.rotationCount);
      return this.saveSession({ ...session, ...patch });
    });
  }
  deleteSession(id: string): Promise<void> {
    return this.write(async () => {
      const session = this.sessions().find((s) => s.id === id);
      if (!session) return;
      const sessionEvents = this.events().filter((e) => e.sessionId === id);
      const eventIds = sessionEvents.map((e) => e.id);
      const eventIdSet = new Set(eventIds);
      const sessionNotes = this.notes().filter(
        (n) => n.sessionId === id || (n.eventId && eventIdSet.has(n.eventId)),
      );
      const noteIds = sessionNotes.map((n) => n.id);

      const changes: DatabaseChange[] = [{ table: 'sessions', delete: [id] }];
      if (eventIds.length) changes.push({ table: 'events', delete: eventIds });
      if (noteIds.length) changes.push({ table: 'notes', delete: noteIds });
      await this.commit(changes);
    });
  }
  recordContact(
    fieldX: number,
    fieldY: number,
    batterSide?: BatterSide,
    expectedPlayerId?: string,
    options: {
      hardHit?: HardHitRating | null;
      contactType?: ContactType | null;
      result?: HitResult | null;
    } = {},
  ): Promise<BallEvent> {
    return this.write(async () => {
      const session = this.session();
      if (expectedPlayerId !== undefined && session.queue[0] !== expectedPlayerId)
        throw new Error(
          'The current hitter changed in another Coach Helper window. Check the updated hitter, then tap the field again. No contact was recorded.',
        );
      const player = this.players().find((p) => p.id === session.queue[0]);
      if (!player) throw new Error('Return a player to the rotation first.');
      const capture = createContact(session, player, fieldX, fieldY, {
        batterSide,
        ...options,
      });
      await this.commit([
        { table: 'events', put: [capture.event] },
        { table: 'sessions', put: [capture.session] },
      ]);
      if (this.settings().haptics && typeof navigator !== 'undefined' && navigator.vibrate)
        navigator.vibrate(12);
      return capture.event;
    });
  }
  recordSwingAndMiss(batterSide?: BatterSide, expectedPlayerId?: string): Promise<BallEvent> {
    return this.recordContact(0.5, 0.88, batterSide, expectedPlayerId, {
      hardHit: 0,
      contactType: null,
      result: 'out',
    });
  }
  enrichEvent(
    id: string,
    patch: Partial<Pick<BallEvent, 'contactType' | 'result' | 'hardHit' | 'notes'>>,
  ): Promise<BallEvent> {
    return this.updateEvent(id, patch);
  }
  updateEvent(
    id: string,
    patch: Partial<BallEvent>,
    noteEdits: { id: string; text: string }[] = [],
  ): Promise<BallEvent> {
    return this.write(async () => {
      const existing = this.events().find((event) => event.id === id);
      if (!existing) throw new Error('Observation not found.');
      const allowed = {
        fieldX: patch.fieldX ?? existing.fieldX,
        fieldY: patch.fieldY ?? existing.fieldY,
        timestamp: patch.timestamp ?? existing.timestamp,
        pitcherHand: patch.pitcherHand === undefined ? existing.pitcherHand : patch.pitcherHand,
        batterSide: patch.batterSide === undefined ? existing.batterSide : patch.batterSide,
        contactType: patch.contactType === undefined ? existing.contactType : patch.contactType,
        result: patch.result === undefined ? existing.result : patch.result,
        hardHit: patch.hardHit === undefined ? existing.hardHit : patch.hardHit,
        notes: patch.notes ?? existing.notes,
      };
      assertCoordinates(allowed.fieldX, allowed.fieldY);
      if (!Number.isFinite(Date.parse(allowed.timestamp)))
        throw new Error('Enter a valid observation date.');
      if (allowed.contactType !== null && !CONTACT_TYPES.includes(allowed.contactType))
        throw new Error('Unknown contact type.');
      if (allowed.result !== null && !HIT_RESULTS.includes(allowed.result))
        throw new Error('Unknown result.');
      if (allowed.hardHit !== null && !HARD_HIT_RATINGS.includes(allowed.hardHit))
        throw new Error('Unknown hard hit rating.');
      if (
        ![null, 'L', 'R'].includes(allowed.pitcherHand) ||
        ![null, 'L', 'R'].includes(allowed.batterSide)
      )
        throw new Error('Unknown handedness.');
      const event = {
        ...existing,
        ...allowed,
        timestamp: new Date(allowed.timestamp).toISOString(),
        updatedAt: now(),
      };
      if (new Set(noteEdits.map((note) => note.id)).size !== noteEdits.length)
        throw new Error('Each timestamped note may be edited only once.');
      const notes = noteEdits.map((edit) => {
        const note = this.notes().find((candidate) => candidate.id === edit.id);
        if (!note || note.eventId !== id)
          throw new Error(
            'A timestamped note no longer belongs to this observation. Reopen the editor and try again.',
          );
        if (!edit.text.trim())
          throw new Error('Timestamped notes cannot be blank. Enter the note text before saving.');
        return { ...note, text: edit.text.trim(), updatedAt: event.updatedAt };
      });
      const changes: DatabaseChange[] = [{ table: 'events', put: [event] }];
      if (notes.length) changes.push({ table: 'notes', put: notes });
      await this.commit(changes);
      return event;
    });
  }
  deleteEvent(id: string): Promise<void> {
    return this.write(async () => {
      const event = this.events().find((e) => e.id === id);
      if (!event) return;
      const session = this.sessions().find((s) => s.id === event.sessionId);
      const changes: DatabaseChange[] = [
        { table: 'events', delete: [id] },
        {
          table: 'notes',
          delete: this.notes()
            .filter((note) => note.eventId === id)
            .map((note) => note.id),
        },
      ];
      if (session)
        changes.push({
          table: 'sessions',
          put: [
            {
              ...session,
              turnContacts:
                session.currentTurn === event.turnSequence
                  ? Math.max(0, session.turnContacts - 1)
                  : session.turnContacts,
              undoStack: session.undoStack
                .filter((undo) => undo.eventId !== id)
                .map((undo) => {
                  const adjust = (state: typeof undo.before) => ({
                    ...state,
                    turnContacts:
                      state.currentTurn === event.turnSequence &&
                      state.nextSequence > event.sequence
                        ? Math.max(0, state.turnContacts - 1)
                        : state.turnContacts,
                  });
                  return { ...undo, before: adjust(undo.before), after: adjust(undo.after) };
                }),
              updatedAt: now(),
            },
          ],
        });
      await this.commit(changes);
    });
  }
  undoLast(): Promise<BallEvent | null> {
    return this.write(async () => {
      const undo = undoContact(this.session());
      if (!undo) return null;
      const event = this.events().find((e) => e.id === undo.eventId) ?? null;
      await this.commit([
        { table: 'events', delete: [undo.eventId] },
        { table: 'sessions', put: [undo.session] },
        {
          table: 'notes',
          delete: this.notes()
            .filter((n) => n.eventId === undo.eventId)
            .map((n) => n.id),
        },
      ]);
      return event;
    });
  }
  nextBatter(): Promise<PracticeSession> {
    return this.write(() => this.saveSession(advanceTurn(this.session())));
  }
  deferBatter(id?: string): Promise<PracticeSession> {
    return this.write(() => {
      const session = this.session();
      const target = id ?? session.queue[0];
      const current = target === session.queue[0];
      return this.saveSession({
        ...session,
        queue: deferQueue(session.queue, target),
        currentTurn: session.currentTurn + (current ? 1 : 0),
        turnContacts: current ? 0 : session.turnContacts,
      });
    });
  }
  reorderQueue(ids: string[]): Promise<PracticeSession> {
    return this.write(() => {
      const session = this.session();
      return this.saveSession({ ...session, queue: reorderUpcoming(session.queue, ids) });
    });
  }
  selectBatter(id: string): Promise<PracticeSession> {
    return this.write(() => {
      const session = this.session();
      const player = this.players().find((p) => p.id === id && p.teamId === session.teamId);
      if (!player) throw new Error('Player not found on this team.');
      if (session.queue[0] === id) return Promise.resolve(session);
      return this.saveSession({
        ...session,
        queue: jumpQueue(session.queue, id),
        participantIds: [...new Set([...session.participantIds, id])],
        currentTurn: session.currentTurn + 1,
        turnContacts: 0,
      });
    });
  }
  removeFromQueue(id: string): Promise<PracticeSession> {
    return this.write(() => {
      const session = this.session();
      const current = session.queue[0] === id;
      return this.saveSession({
        ...session,
        queue: session.queue.filter((p) => p !== id),
        currentTurn: session.currentTurn + (current ? 1 : 0),
        turnContacts: current ? 0 : session.turnContacts,
      });
    });
  }
  returnToQueue(id: string): Promise<PracticeSession> {
    return this.write(() => {
      const session = this.session();
      if (!this.players().some((p) => p.id === id && p.teamId === session.teamId))
        throw new Error('Player not found on this team.');
      return this.saveSession({
        ...session,
        queue: [...new Set([...session.queue, id])],
        participantIds: [...new Set([...session.participantIds, id])],
      });
    });
  }
  setPitcherHand(pitcherHand: 'L' | 'R'): Promise<PracticeSession> {
    return this.write(() => this.saveSession({ ...this.session(), pitcherHand }));
  }
  setRotation(rotationCount: number | null): Promise<PracticeSession> {
    return this.write(() => {
      requireRotation(rotationCount);
      return this.saveSession({ ...this.session(), rotationCount });
    });
  }
  addNote(
    scope: { playerId?: string; sessionId?: string; eventId?: string },
    text: string,
  ): Promise<CoachNote> {
    return this.write(async () => {
      const event = scope.eventId ? this.events().find((e) => e.id === scope.eventId) : null;
      const sessionId = scope.sessionId ?? event?.sessionId ?? null;
      const playerId = scope.playerId ?? event?.playerId ?? null;
      const session = this.sessions().find((s) => s.id === sessionId);
      const player = this.players().find((p) => p.id === playerId);
      const teamId =
        event?.teamId ?? session?.teamId ?? player?.teamId ?? this.settings().activeTeamId;
      if (!teamId || !text.trim()) throw new Error('Enter a note for a team, player, or practice.');
      if (
        (scope.eventId && !event) ||
        (sessionId && !session) ||
        (playerId && !player) ||
        (session && session.teamId !== teamId) ||
        (player && player.teamId !== teamId)
      )
        throw new Error('The note must refer to records on the same team.');
      const note: CoachNote = {
        ...entity(),
        teamId,
        playerId,
        sessionId,
        eventId: scope.eventId ?? null,
        timestamp: now(),
        text: text.trim(),
      };
      await this.commit([{ table: 'notes', put: [note] }]);
      return note;
    });
  }
  updateNote(id: string, text: string): Promise<void> {
    return this.write(async () => {
      const note = this.notes().find((n) => n.id === id);
      if (!note || !text.trim()) throw new Error('Enter a note.');
      await this.commit([
        { table: 'notes', put: [{ ...note, text: text.trim(), updatedAt: now() }] },
      ]);
    });
  }
  deleteNote(id: string): Promise<void> {
    return this.write(() => this.commit([{ table: 'notes', delete: [id] }]));
  }
  updateSettings(patch: Partial<AppSettings>): Promise<void> {
    return this.write(async () => {
      const settings = {
        ...this.settings(),
        ...patch,
        id: 'preferences' as const,
        updatedAt: now(),
      };
      requireRotation(settings.rotationCount);
      if (settings.activeTeamId && !this.teams().some((t) => t.id === settings.activeTeamId))
        throw new Error('Team not found.');
      await this.commit([{ table: 'settings', put: [settings] }]);
    });
  }
  refresh(): Promise<void> {
    return this.write(async () => undefined);
  }
  exportFreshBackup(): Promise<BackupData> {
    return this.write(async () => this.exportBackup());
  }
  exportBackup(): BackupData {
    return structuredClone({
      schemaVersion: 1,
      application: 'Pinch Hitter',
      applicationVersion: APP_VERSION,
      exportedAt: now(),
      teams: this.teams(),
      players: this.players(),
      sessions: this.sessions(),
      events: this.events(),
      notes: this.notes(),
      settings: this.settings(),
    });
  }
  previewImport(text: string): ImportPreview {
    const preview = parseBackup(text);
    for (const table of ['teams', 'players', 'sessions', 'events', 'notes'] as const) {
      const existing = new Set(this[table]().map((record) => record.id));
      preview.conflicts += preview.data[table].filter((record) => existing.has(record.id)).length;
    }
    if (preview.conflicts)
      preview.warnings.push(
        'Matching IDs are merged using the newest updated timestamp. Existing records absent from the file are kept.',
      );
    if (preview.conflicts)
      preview.warnings.push(
        'Shared practices keep every distinct observation. Conflicting sequence numbers are reassigned; merged practice undo history is cleared.',
      );
    mergeBackups(this.exportBackup(), preview.data);
    return preview;
  }
  importBackup(preview: ImportPreview): Promise<void> {
    return this.write(async () => {
      // Validate again at the write boundary: a preview is not an authority to bypass integrity checks.
      const imported = parseBackup(JSON.stringify(preview.data)).data;
      const data = mergeBackups(this.exportBackup(), imported);
      const changes: DatabaseChange[] = [];
      for (const table of ['teams', 'players', 'sessions', 'events', 'notes'] as const) {
        const local = new Map<string, DatabaseRecords[TableName]>(
          this[table]().map((record) => [record.id, record]),
        );
        const records = data[table].filter(
          (record) => JSON.stringify(local.get(record.id)) !== JSON.stringify(record),
        );
        changes.push({ table, put: records });
      }
      changes.push({ table: 'settings', put: [data.settings] });
      await this.commit(changes);
    });
  }
  clearAll(): Promise<void> {
    return this.write(() => this.commit([], true));
  }
}

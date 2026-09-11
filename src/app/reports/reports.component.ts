import { CommonModule } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CoachStore } from '../data/coach-store';
import { filterEvents, summarizeEvents } from '../data/domain';
import {
  BallEvent,
  CONTACT_TYPES,
  ContactType,
  HARD_HIT_RATINGS,
  HardHitRating,
  HIT_RESULTS,
  HitResult,
  Player,
  PracticeSession,
} from '../data/models';
import { eventsCsv } from '../data/transfer';
import { FieldComponent } from '../shared/field.component';
import { I18nService } from '../i18n/i18n.service';
import {
  dateBoundaries,
  localDate,
  percent,
  periodDates,
  recentComparison,
} from './report-analytics';

interface ReportSelection {
  playerId: string;
  sessionIds: string[];
  preset: string;
  from: string;
  through: string;
  pitcherHand: '' | 'L' | 'R' | 'unknown';
  contactType: '' | ContactType | 'unknown';
  result: '' | HitResult | 'unknown';
  hardHit: '' | HardHitRating | 'unknown';
}

const initialSelection = (): ReportSelection => ({
  playerId: '',
  sessionIds: [],
  preset: 'season',
  from: '',
  through: '',
  pitcherHand: '',
  contactType: '',
  result: '',
  hardHit: '',
});

@Component({
  selector: 'app-reports',
  imports: [CommonModule, FormsModule, RouterLink, FieldComponent],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  readonly store = inject(CoachStore);
  readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly editor = viewChild<ElementRef<HTMLDialogElement>>('editor');
  readonly printArea = viewChild<ElementRef<HTMLElement>>('printArea');
  readonly filters = signal<ReportSelection>(initialSelection());
  readonly view = signal<'spray' | 'heat' | 'history'>('spray');
  readonly colorBy = signal<'contactType' | 'result' | 'hardHit'>('contactType');
  readonly selectedId = signal('');
  readonly historyLimit = signal(40);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly contactTypes = CONTACT_TYPES;
  readonly results = HIT_RESULTS;
  get contactLabels(): Record<ContactType, string> {
    return this.i18n.contactLabels();
  }
  get resultLabels(): Record<HitResult, string> {
    return this.i18n.resultLabels();
  }
  readonly hardHitRatings = HARD_HIT_RATINGS;
  get hardHitLabels(): Record<HardHitRating, string> {
    return this.i18n.hardHitLabels();
  }
  get hardHitShortLabels(): Record<HardHitRating, string> {
    return this.i18n.hardHitShortLabels();
  }
  readonly percent = percent;
  editDraft: BallEvent | null = null;
  editAssociatedNotes: { id: string; timestamp: string; text: string; originalText: string }[] = [];
  editTime = '';
  deletePending = false;
  deleteSessionPending = false;
  editingSession = false;
  sessionTitle = '';
  sessionLocation = '';
  sessionNotes = '';
  noteText = '';
  selectedEventIds = signal<Set<string>>(new Set());
  bulkTargetPlayerId = '';
  bulkDeletePending = false;
  managePlayerModalOpen = signal(false);
  playerManageAction = signal<'move' | 'delete'>('move');
  playerManageTargetId = '';

  legendShapeClass(typeOrRating: string | number): string {
    if (!this.store.settings().shapeMarkers) return 'shape-circle';
    if (this.colorBy() === 'result') {
      switch (typeOrRating) {
        case 'out':
          return 'shape-cross';
        case 'single':
          return 'shape-circle';
        case 'double':
          return 'shape-diamond';
        case 'triple':
          return 'shape-triangle-up';
        case 'home-run':
          return 'shape-star';
        default:
          return 'shape-circle';
      }
    }
    if (this.colorBy() === 'hardHit') {
      switch (typeOrRating) {
        case 0:
          return 'shape-cross';
        case 1:
        case 2:
          return 'shape-circle';
        case 3:
          return 'shape-triangle-up';
        case 4:
          return 'shape-diamond';
        case 5:
          return 'shape-square';
        default:
          return 'shape-circle';
      }
    }
    switch (typeOrRating) {
      case 'dribbler':
        return 'shape-small-circle';
      case 'ground-ball':
        return 'shape-circle';
      case 'line-drive':
        return 'shape-diamond';
      case 'fly-ball':
        return 'shape-triangle-up';
      case 'pop-up':
        return 'shape-triangle-down';
      default:
        return 'shape-circle';
    }
  }

  readonly players = computed(() =>
    this.store
      .players()
      .filter((player) => player.teamId === this.store.activeTeam()?.id)
      .sort((a, b) => a.order - b.order),
  );
  readonly sessions = computed(() =>
    this.store
      .sessions()
      .filter((session) => session.teamId === this.store.activeTeam()?.id)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
  );
  readonly player = computed(() =>
    this.players().find((player) => player.id === this.filters().playerId),
  );
  readonly session = computed(() =>
    this.filters().sessionIds.length === 1
      ? this.sessions().find((session) => session.id === this.filters().sessionIds[0])
      : undefined,
  );
  readonly scopeEvents = computed(() =>
    filterEvents(this.store.events(), {
      teamId: this.store.activeTeam()?.id || '__no_team__',
      playerId: this.filters().playerId || undefined,
    }),
  );
  readonly observations = computed(() => {
    const selected = this.filters();
    if (selected.from && selected.through && selected.from > selected.through) return [];
    return filterEvents(this.scopeEvents(), {
      sessionIds: selected.sessionIds.length ? selected.sessionIds : undefined,
      ...dateBoundaries(selected.from, selected.through),
      pitcherHand: selected.pitcherHand === 'unknown' ? null : selected.pitcherHand || undefined,
      contactType: selected.contactType === 'unknown' ? null : selected.contactType || undefined,
      result: selected.result === 'unknown' ? null : selected.result || undefined,
      hardHit:
        selected.hardHit === 'unknown'
          ? null
          : selected.hardHit === ''
            ? undefined
            : (Number(selected.hardHit) as HardHitRating),
    });
  });
  readonly summary = computed(() => summarizeEvents(this.observations()));
  readonly comparison = computed(() => recentComparison(this.scopeEvents()));
  readonly selectedEvent = computed(() =>
    this.observations().find((event) => event.id === this.selectedId()),
  );
  readonly selectedNotes = computed(() =>
    this.store
      .notes()
      .filter((note) => note.eventId === this.selectedId())
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
  );
  readonly history = computed(() =>
    [...this.observations()].sort(
      (a, b) => b.timestamp.localeCompare(a.timestamp) || b.sequence - a.sequence,
    ),
  );
  readonly visibleHistory = computed(() => this.history().slice(0, this.historyLimit()));
  readonly directionalTotal = computed(
    () => this.summary().total - this.summary().directions.unknown,
  );
  readonly title = computed(() => this.player()?.name || this.session()?.title || 'Team report');
  readonly context = computed(() => {
    const f = this.filters();
    const parts = [this.store.activeTeam()?.name || 'Your team'];
    if (this.store.activeTeam()?.season) parts.push(this.store.activeTeam()!.season);
    if (f.sessionIds.length)
      parts.push(
        `${f.sessionIds.length} selected ${f.sessionIds.length === 1 ? 'practice' : 'practices'}`,
      );
    else if (!f.from && !f.through) parts.push('All practices');
    if (f.from || f.through) parts.push(`${f.from || 'Beginning'} to ${f.through || 'today'}`);
    if (f.pitcherHand)
      parts.push(f.pitcherHand === 'unknown' ? 'Unknown pitcher hand' : `${f.pitcherHand}HP`);
    if (f.contactType)
      parts.push(
        f.contactType === 'unknown' ? 'Unclassified contact' : this.contactLabels[f.contactType],
      );
    if (f.result)
      parts.push(f.result === 'unknown' ? 'Unclassified result' : this.resultLabels[f.result]);
    if (f.hardHit !== '')
      parts.push(
        f.hardHit === 'unknown'
          ? 'Unclassified hard hit'
          : this.hardHitLabels[Number(f.hardHit) as HardHitRating],
      );
    return parts.join(' · ');
  });
  readonly playerActivity = computed(() => {
    const counts = this.summary().byPlayer;
    return this.players()
      .filter((player) => counts[player.id])
      .map((player) => ({
        player,
        count: counts[player.id],
      }))
      .sort((a, b) => b.count - a.count);
  });
  readonly sessionActivity = computed(() => {
    const counts = new Map<string, number>();
    for (const event of this.observations())
      counts.set(event.sessionId, (counts.get(event.sessionId) || 0) + 1);
    return this.sessions()
      .filter((session) => counts.has(session.id))
      .map((session) => ({ session, count: counts.get(session.id)! }));
  });
  readonly reportNotes = computed(() =>
    this.store
      .notes()
      .filter((note) => {
        if (note.teamId !== this.store.activeTeam()?.id) return false;
        const f = this.filters();
        if (f.playerId && note.playerId !== f.playerId) return false;
        if (f.sessionIds.length && (!note.sessionId || !f.sessionIds.includes(note.sessionId)))
          return false;
        return !note.eventId;
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  );
  readonly contactDistribution = computed(() =>
    this.contactTypes.map((type) => ({
      type,
      label: this.contactLabels[type],
      count: this.summary().contacts[type] || 0,
    })),
  );
  readonly resultDistribution = computed(() =>
    this.results.map((type) => ({
      type,
      label: this.resultLabels[type],
      count: this.summary().results[type] || 0,
    })),
  );
  readonly hardHitDistribution = computed(() =>
    this.hardHitRatings.map((rating) => ({
      rating,
      label: this.hardHitLabels[rating],
      shortLabel: this.hardHitShortLabels[rating],
      count: this.summary().hardHits[rating] || 0,
    })),
  );

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      this.filters.update((filters) => ({
        ...filters,
        playerId: query.get('player') || '',
        sessionIds: query.getAll('session'),
      }));
      this.selectedId.set('');
      this.historyLimit.set(40);
    });
  }

  setFilter<K extends keyof ReportSelection>(key: K, value: ReportSelection[K]): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
    this.selectedId.set('');
    this.historyLimit.set(40);
  }

  selectPlayer(playerId: string): void {
    this.setFilter('playerId', playerId);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        player: playerId || null,
        session: this.filters().sessionIds.length ? this.filters().sessionIds : null,
      },
      replaceUrl: true,
    });
  }

  applyPreset(preset: string): void {
    // A team defines the season; free-text season labels are never guessed into calendar boundaries.
    const dates = ['1', '7', '30'].includes(preset)
      ? periodDates(Number(preset))
      : preset === 'custom'
        ? { from: this.filters().from, through: this.filters().through }
        : { from: '', through: '' };
    this.filters.update((filters) => ({
      ...filters,
      preset,
      ...dates,
      sessionIds:
        preset === 'latest' && this.sessions().length
          ? [this.sessions()[0].id]
          : preset === 'custom'
            ? filters.sessionIds
            : [],
    }));
    this.selectedId.set('');
    this.historyLimit.set(40);
    this.syncScope();
  }

  toggleSession(id: string): void {
    this.filters.update((filters) => ({
      ...filters,
      preset: 'custom',
      sessionIds: filters.sessionIds.includes(id)
        ? filters.sessionIds.filter((selected) => selected !== id)
        : [...filters.sessionIds, id],
    }));
    this.selectedId.set('');
    this.historyLimit.set(40);
    this.syncScope();
  }

  private syncScope(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        player: this.filters().playerId || null,
        session: this.filters().sessionIds.length ? this.filters().sessionIds : null,
      },
      replaceUrl: true,
    });
  }

  resetFilters(): void {
    const playerId = this.filters().playerId;
    this.filters.set({ ...initialSelection(), playerId });
    this.selectedId.set('');
    this.historyLimit.set(40);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { player: playerId || null },
      replaceUrl: true,
    });
  }

  selectObservation(id: string): void {
    this.selectedId.set(id);
    setTimeout(
      () => document.getElementById('selected-observation')?.scrollIntoView({ block: 'nearest' }),
      0,
    );
  }

  openEditor(event: BallEvent): void {
    this.editDraft = { ...event };
    this.editAssociatedNotes = this.store
      .notes()
      .filter((note) => note.eventId === event.id)
      .map((note) => ({
        id: note.id,
        timestamp: note.timestamp,
        text: note.text,
        originalText: note.text,
      }));
    const date = new Date(event.timestamp);
    this.editTime = `${localDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
    this.deletePending = false;
    this.error.set('');
    this.editor()?.nativeElement.showModal();
  }

  relocate(point: { x: number; y: number }): void {
    if (this.editDraft) this.editDraft = { ...this.editDraft, fieldX: point.x, fieldY: point.y };
  }

  cancelEditor(): void {
    this.editor()?.nativeElement.close();
    this.editDraft = null;
    this.editAssociatedNotes = [];
    this.deletePending = false;
    this.error.set('');
  }

  async saveEvent(): Promise<void> {
    if (!this.editDraft || this.busy()) return;
    if (!this.editTime || !Number.isFinite(new Date(this.editTime).getTime())) {
      this.error.set('Choose a valid date and time for this observation.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const draft = this.editDraft;
      await this.store.updateEvent(
        draft.id,
        {
          playerId: draft.playerId,
          fieldX: draft.fieldX,
          fieldY: draft.fieldY,
          timestamp: new Date(this.editTime).toISOString(),
          pitcherHand: draft.pitcherHand,
          batterSide: draft.batterSide,
          contactType: draft.contactType,
          result: draft.result,
          hardHit: draft.hardHit,
          notes: draft.notes,
        },
        this.editAssociatedNotes.map(({ id, text }) => ({ id, text })),
      );
      this.cancelEditor();
      this.message.set('Observation updated. Your report now includes the correction.');
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'This correction could not be saved. Please try again.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  async deleteEvent(): Promise<void> {
    if (!this.editDraft || this.busy()) return;
    this.busy.set(true);
    try {
      await this.store.deleteEvent(this.editDraft.id);
      this.cancelEditor();
      this.selectedId.set('');
      this.message.set('Observation deleted.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not delete this observation.');
    } finally {
      this.busy.set(false);
    }
  }

  isSelected(id: string): boolean {
    return this.selectedEventIds().has(id);
  }

  toggleSelectEvent(id: string): void {
    this.selectedEventIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  selectAllVisible(): void {
    const ids = this.history().map((e) => e.id);
    this.selectedEventIds.set(new Set(ids));
  }

  deselectAll(): void {
    this.selectedEventIds.set(new Set());
    this.bulkDeletePending = false;
  }

  async moveSelectedEvents(): Promise<void> {
    const ids = Array.from(this.selectedEventIds());
    if (!ids.length || !this.bulkTargetPlayerId || this.busy()) return;
    const targetPlayer = this.players().find((p) => p.id === this.bulkTargetPlayerId);
    if (!targetPlayer) return;
    this.busy.set(true);
    try {
      await this.store.moveEvents(ids, this.bulkTargetPlayerId);
      this.message.set(
        `Moved ${ids.length} contact${ids.length > 1 ? 's' : ''} to ${targetPlayer.name}.`,
      );
      this.deselectAll();
      this.bulkTargetPlayerId = '';
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not move contacts.');
    } finally {
      this.busy.set(false);
    }
  }

  async deleteSelectedEvents(): Promise<void> {
    const ids = Array.from(this.selectedEventIds());
    if (!ids.length || this.busy()) return;
    this.busy.set(true);
    try {
      await this.store.deleteEvents(ids);
      this.message.set(`Deleted ${ids.length} contact${ids.length > 1 ? 's' : ''}.`);
      this.deselectAll();
      if (this.selectedId() && ids.includes(this.selectedId())) {
        this.selectedId.set('');
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not delete contacts.');
    } finally {
      this.busy.set(false);
    }
  }

  playerHitCount(playerId: string): number {
    return this.store.events().filter((e) => e.playerId === playerId).length;
  }

  otherPlayers(playerId: string): Player[] {
    return this.players().filter((p) => p.id !== playerId);
  }

  openManagePlayerModal(): void {
    this.playerManageAction.set('move');
    this.playerManageTargetId = '';
    this.managePlayerModalOpen.set(true);
  }

  async moveAllPlayerContacts(sourcePlayerId: string, targetPlayerId: string): Promise<void> {
    if (!sourcePlayerId || !targetPlayerId || this.busy()) return;
    const events = this.store.events().filter((e) => e.playerId === sourcePlayerId);
    if (!events.length) return;
    const targetPlayer = this.players().find((p) => p.id === targetPlayerId);
    this.busy.set(true);
    try {
      await this.store.moveEvents(
        events.map((e) => e.id),
        targetPlayerId,
      );
      this.message.set(`Moved all ${events.length} contacts to ${targetPlayer?.name || 'player'}.`);
      this.managePlayerModalOpen.set(false);
      this.setFilter('playerId', targetPlayerId);
      this.syncScope();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not move player contacts.');
    } finally {
      this.busy.set(false);
    }
  }

  async deleteAllPlayerContacts(playerId: string): Promise<void> {
    if (!playerId || this.busy()) return;
    const events = this.store.events().filter((e) => e.playerId === playerId);
    if (!events.length) return;
    this.busy.set(true);
    try {
      await this.store.deleteEvents(events.map((e) => e.id));
      this.message.set(`Permanently deleted all ${events.length} contacts for this player.`);
      this.managePlayerModalOpen.set(false);
      this.selectedId.set('');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not delete player contacts.');
    } finally {
      this.busy.set(false);
    }
  }

  async deleteSession(): Promise<void> {
    const session = this.session();
    if (!session || this.busy()) return;
    this.busy.set(true);
    try {
      await this.store.deleteSession(session.id);
      this.deleteSessionPending = false;
      this.message.set(`Practice "${session.title || 'Batting practice'}" deleted.`);
      this.setFilter('sessionIds', []);
      this.syncScope();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not delete this practice.');
    } finally {
      this.busy.set(false);
    }
  }

  editSession(session: PracticeSession): void {
    this.sessionTitle = session.title;
    this.sessionLocation = session.location;
    this.sessionNotes = session.notes;
    this.editingSession = true;
  }

  async saveSession(): Promise<void> {
    const session = this.session();
    if (!session || this.busy()) return;
    this.busy.set(true);
    try {
      await this.store.updateSession(session.id, {
        title: this.sessionTitle.trim(),
        location: this.sessionLocation.trim(),
        notes: this.sessionNotes.trim(),
      });
      this.editingSession = false;
      this.message.set('Practice details saved.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not save practice details.');
    } finally {
      this.busy.set(false);
    }
  }

  async resumeSession(): Promise<void> {
    const session = this.session();
    if (!session || this.busy()) return;
    this.busy.set(true);
    try {
      await this.store.resumeSession(session.id);
      await this.router.navigate(['/practice']);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not resume this practice.');
    } finally {
      this.busy.set(false);
    }
  }

  async addNote(): Promise<void> {
    if (!this.noteText.trim() || this.busy()) return;
    this.busy.set(true);
    try {
      await this.store.addNote(
        { playerId: this.player()?.id, sessionId: this.session()?.id },
        this.noteText.trim(),
      );
      this.noteText = '';
      this.message.set('Coaching note saved.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not save this note.');
    } finally {
      this.busy.set(false);
    }
  }

  duration(session: PracticeSession): string {
    const minutes = Math.max(
      0,
      Math.round(
        (new Date(session.endedAt || new Date()).getTime() -
          new Date(session.startedAt).getTime()) /
          60000,
      ),
    );
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
  }

  eventName(event: BallEvent): string {
    return (
      this.store.players().find((player) => player.id === event.playerId)?.name || event.playerName
    );
  }

  sessionName(id: string): string {
    const session = this.sessions().find((candidate) => candidate.id === id);
    return session?.title || 'Batting practice';
  }

  async exportCsv(share = false): Promise<void> {
    try {
      await this.store.refresh();
    } catch {
      this.error.set('The latest notebook could not be read. Please try exporting again.');
      return;
    }
    const content = eventsCsv(
      this.observations(),
      this.store.teams(),
      this.store.sessions(),
      this.store.notes(),
    );
    const name = `${(
      this.player()?.name ||
      this.session()?.title ||
      this.store.activeTeam()?.shortName ||
      'team'
    )
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-contacts-${localDate(new Date())}.csv`;
    const file = new File([content], name, { type: 'text/csv;charset=utf-8' });
    try {
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${this.title()} · Pinch Hitter` });
        this.message.set('Report shared.');
        return;
      }
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.message.set(
        share
          ? 'File sharing is unavailable here. Your CSV was downloaded instead.'
          : `Exported ${this.observations().length} observations to CSV.`,
      );
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        this.error.set('The file could not be shared. Try Download CSV.');
    }
  }

  print(): void {
    window.print();
  }
}

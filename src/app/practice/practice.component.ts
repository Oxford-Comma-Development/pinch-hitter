import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CoachStore } from '../data/coach-store';
import {
  BallEvent,
  ContactType,
  HitResult,
  Player,
  CONTACT_TYPES,
  HARD_HIT_RATINGS,
  HardHitRating,
  HIT_RESULTS,
} from '../data/models';
import { FieldComponent, FieldPoint } from '../shared/field.component';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';

interface SpeechResultEvent {
  results: Record<number, Record<number, { transcript: string; confidence: number }>>;
}
interface SpeechService {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type SpeechConstructor = new () => SpeechService;

export function findSpokenPlayers(players: Player[], transcript: string): Player[] {
  const clean = (value: string) =>
    value
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  let term = clean(transcript).replace(/^(number|jersey|select|player)\s+/, '');
  const numbers: Record<string, string> = {
    zero: '0',
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
    nine: '9',
    ten: '10',
    eleven: '11',
    twelve: '12',
    thirteen: '13',
    fourteen: '14',
    fifteen: '15',
    sixteen: '16',
    seventeen: '17',
    eighteen: '18',
    nineteen: '19',
    twenty: '20',
    thirty: '30',
    forty: '40',
    fifty: '50',
  };
  term = numbers[term] ?? term;
  if (!term) return [];
  const exact = players.filter(
    (player) =>
      clean(player.name) === term ||
      (player.jerseyNumber !== '' && clean(player.jerseyNumber) === term),
  );
  if (exact.length) return exact;
  return players.filter(
    (player) =>
      clean(player.name).includes(term) ||
      term
        .split(' ')
        .some((word) => word.length > 2 && clean(player.name).split(' ').includes(word)),
  );
}

@Component({
  selector: 'app-practice',
  imports: [FormsModule, RouterLink, FieldComponent, TranslatePipe],
  templateUrl: './practice.component.html',
  styleUrl: './practice.component.scss',
})
export class PracticeComponent implements OnDestroy {
  readonly store = inject(CoachStore);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('sheet');
  readonly busy = signal(false);
  readonly message = signal('');
  readonly failure = signal('');
  readonly selectedIds = signal<string[]>([]);
  readonly latestId = signal('');
  readonly sheetMode = signal<'queue' | 'players' | 'note' | 'options' | 'finish' | ''>('');
  readonly dragOrder = signal<string[] | null>(null);
  readonly draggedId = signal('');
  readonly listening = signal(false);
  readonly voiceMatches = signal<Player[] | null>(null);
  readonly query = signal('');
  readonly switchSides = signal<Record<string, 'L' | 'R'>>({});
  readonly contactTypes = CONTACT_TYPES;
  readonly contactLabels = this.i18n.contactLabels;
  readonly results = HIT_RESULTS;
  readonly resultLabels = this.i18n.resultLabels;
  readonly hardHitRatings = HARD_HIT_RATINGS;
  readonly hardHitLabels = this.i18n.hardHitLabels;
  readonly hardHitShortLabels = this.i18n.hardHitShortLabels;
  title = '';
  location = '';
  sessionNote = '';
  rotation = 'manual';
  customCount = 8;
  noteText = '';
  noteScope = 'player';
  private initialized = false;
  private speech?: SpeechService;
  private dragMoved = false;
  private dragFinishedAt = 0;

  readonly current = computed(() =>
    this.store.players().find((player) => player.id === this.store.activeSession()?.queue[0]),
  );
  readonly orderedQueue = computed(() =>
    (this.dragOrder() ?? this.store.activeSession()?.queue ?? [])
      .map((id) => this.store.players().find((player) => player.id === id))
      .filter((player): player is Player => !!player),
  );
  readonly sessionEvents = computed(() =>
    this.store
      .events()
      .filter((event) => event.sessionId === this.store.activeSession()?.id)
      .sort((a, b) => a.sequence - b.sequence),
  );
  readonly hitterEvents = computed(() =>
    this.sessionEvents().filter((event) => event.playerId === this.current()?.id),
  );
  readonly batterSide = computed(() => {
    const player = this.current();
    if (!player) return null;
    if (player.bats !== 'S') return player.bats;
    // Recover the most recently recorded side after an interrupted session.
    return (
      this.switchSides()[player.id] ??
      [...this.hitterEvents()].reverse().find((event) => event.batterSide)?.batterSide ??
      null
    );
  });
  readonly latest = computed(() => {
    const events = this.sessionEvents();
    return events.find((event) => event.id === this.latestId()) ?? events[events.length - 1];
  });
  readonly startingPlayers = computed(() =>
    this.selectedIds()
      .map((id) => this.store.roster().find((player) => player.id === id))
      .filter((player): player is Player => !!player),
  );
  readonly availablePlayers = computed(() => {
    const term = this.query().trim().toLowerCase();
    const players = this.voiceMatches() ?? this.store.roster();
    return players.filter(
      (player) =>
        !term || player.name.toLowerCase().includes(term) || player.jerseyNumber.includes(term),
    );
  });
  readonly removedPlayers = computed(() =>
    this.store.roster().filter((player) => !this.store.activeSession()?.queue.includes(player.id)),
  );

  constructor() {
    effect(() => {
      if (!this.initialized && this.store.ready()) {
        this.initialized = true;
        this.selectedIds.set(this.store.roster().map((player) => player.id));
        const count = this.store.settings().rotationCount;
        this.rotation =
          count === null ? 'manual' : [1, 3, 5].includes(count) ? String(count) : 'custom';
        this.customCount = count ?? 8;
      }
    });
  }

  ngOnDestroy(): void {
    this.speech?.abort();
  }
  playerName(id: string): string {
    return this.store.players().find((player) => player.id === id)?.name ?? 'Player';
  }
  jersey(player?: Player): string {
    return player?.jerseyNumber ? `#${player.jerseyNumber}` : '—';
  }

  toggleParticipant(id: string): void {
    this.selectedIds.update((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  }

  selectAll(): void {
    this.selectedIds.set(this.store.roster().map((player) => player.id));
  }

  moveStart(id: string, amount: number): void {
    const ids = [...this.selectedIds()];
    const index = ids.indexOf(id);
    const target = index + amount;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.selectedIds.set(ids);
  }

  async action(work: () => Promise<unknown>, success = ''): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.failure.set('');
    try {
      await work();
      if (success) this.message.set(success);
      return true;
    } catch (error) {
      this.failure.set(
        error instanceof Error ? error.message : 'Could not save. Please try again.',
      );
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  rotationCount(): number | null {
    return this.rotation === 'manual'
      ? null
      : this.rotation === 'custom'
        ? Number(this.customCount)
        : Number(this.rotation);
  }

  async start(): Promise<void> {
    const count = this.rotationCount();
    if (!this.selectedIds().length) {
      this.failure.set('Choose at least one hitter.');
      return;
    }
    if (count !== null && (!Number.isInteger(count) || count < 1 || count > 100)) {
      this.failure.set('Choose 1 to 100 recorded contacts for automatic rotation.');
      return;
    }
    await this.action(() =>
      this.store.startSession({
        playerIds: this.selectedIds(),
        title: this.title,
        location: this.location,
        notes: this.sessionNote,
        rotationCount: count,
      }),
    );
  }

  async capture(point: FieldPoint): Promise<void> {
    const player = this.current();
    if (!player) return;
    const side = this.batterSide();
    await this.action(async () => {
      const event = await this.store.recordContact(point.x, point.y, side, player.id);
      this.latestId.set(event.id);
      this.message.set(`Contact ${event.contactSequence} saved for ${player.name}.`);
    });
  }

  async classify(type: 'contactType' | 'result', value: ContactType | HitResult): Promise<void> {
    const event = this.latest();
    if (!event) return;
    const patch = { [type]: event[type] === value ? null : value } as Partial<
      Pick<BallEvent, 'contactType' | 'result'>
    >;
    await this.action(() => this.store.enrichEvent(event.id, patch), 'Last contact updated.');
  }

  async recordWhiff(): Promise<void> {
    const player = this.current();
    if (!player) return;
    const side = this.batterSide();
    await this.action(async () => {
      const event = await this.store.recordSwingAndMiss(side, player.id);
      this.latestId.set(event.id);
      this.message.set(`Swing & miss recorded for ${player.name}.`);
    });
  }

  async classifyHardHit(level: HardHitRating): Promise<void> {
    if (level === 0) {
      await this.recordWhiff();
      return;
    }
    const event = this.latest();
    if (!event) return;
    const next = event.hardHit === level ? null : level;
    await this.action(
      () => this.store.enrichEvent(event.id, { hardHit: next }),
      'Hard hit rating updated.',
    );
  }

  async undo(): Promise<void> {
    await this.action(() => this.store.undoLast(), 'Last contact removed; batting order restored.');
  }
  async next(): Promise<void> {
    await this.action(() => this.store.nextBatter(), 'Next hitter is ready.');
  }
  async defer(id?: string): Promise<void> {
    await this.action(() => this.store.deferBatter(id), 'Hitter moved to the back of the line.');
  }
  async setPitcher(hand: 'L' | 'R'): Promise<void> {
    await this.action(() => this.store.setPitcherHand(hand));
  }
  setSide(side: 'L' | 'R'): void {
    const id = this.current()?.id;
    if (id) this.switchSides.update((sides) => ({ ...sides, [id]: side }));
  }

  openSheet(mode: Exclude<ReturnType<typeof this.sheetMode>, ''>): void {
    this.sheetMode.set(mode);
    this.failure.set('');
    if (mode === 'players') {
      this.query.set('');
      this.voiceMatches.set(null);
    }
    if (mode === 'options') {
      const count = this.store.activeSession()?.rotationCount ?? null;
      this.rotation =
        count === null ? 'manual' : [1, 3, 5].includes(count) ? String(count) : 'custom';
      this.customCount = count ?? 8;
    }
    if (mode === 'note') {
      this.noteText = '';
      this.noteScope = this.current() ? 'player' : 'session';
    }
    this.dialog()?.nativeElement.showModal();
  }

  closeSheet(): void {
    this.dialog()?.nativeElement.close();
    this.onSheetClosed();
  }

  onSheetClosed(): void {
    if (this.speech) {
      this.speech.onresult = null;
      this.speech.onerror = null;
      this.speech.abort();
    }
    this.listening.set(false);
    this.sheetMode.set('');
  }

  async select(id: string): Promise<void> {
    if (await this.action(() => this.store.selectBatter(id), `${this.playerName(id)} is hitting.`))
      this.closeSheet();
  }

  async moveQueue(id: string, amount: number): Promise<void> {
    const ids = [...(this.store.activeSession()?.queue ?? [])];
    const index = ids.indexOf(id);
    const target = index + amount;
    if (index < 1 || target < 1 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await this.action(() => this.store.reorderQueue(ids), 'Batting order updated.');
  }

  startDrag(event: PointerEvent, id: string): void {
    if (this.busy() || event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.draggedId.set(id);
    this.dragMoved = false;
    this.dragOrder.set([...(this.store.activeSession()?.queue ?? [])]);
  }

  @HostListener('window:pointermove', ['$event'])
  drag(event: PointerEvent): void {
    const ids = this.dragOrder();
    if (!ids || !this.draggedId()) return;
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('[data-queue-id]')
      ?.getAttribute('data-queue-id');
    const from = ids.indexOf(this.draggedId());
    const to = target ? ids.indexOf(target) : -1;
    if (from < 1 || to < 1 || from === to) return;
    this.dragMoved = true;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    this.dragOrder.set(next);
  }

  @HostListener('window:pointerup')
  async finishDrag(): Promise<void> {
    const ids = this.dragOrder();
    this.draggedId.set('');
    if (ids && this.dragMoved) {
      this.dragFinishedAt = Date.now();
      await this.action(() => this.store.reorderQueue(ids), 'Batting order updated.');
    }
    this.dragOrder.set(null);
  }
  queueHandleClick(): void {
    if (Date.now() - this.dragFinishedAt > 350) this.openSheet('queue');
  }
  @HostListener('window:pointercancel')
  cancelDrag(): void {
    this.draggedId.set('');
    this.dragOrder.set(null);
  }
  async remove(id: string): Promise<void> {
    await this.action(
      () => this.store.removeFromQueue(id),
      'Hitter is sitting out. Return them whenever ready.',
    );
  }
  async returnPlayer(id: string): Promise<void> {
    await this.action(() => this.store.returnToQueue(id), 'Hitter returned to the line.');
  }

  async saveOptions(): Promise<void> {
    const count = this.rotationCount();
    if (count !== null && (!Number.isInteger(count) || count < 1 || count > 100)) {
      this.failure.set('Enter a whole number from 1 to 100.');
      return;
    }
    if (
      await this.action(
        () => this.store.setRotation(count),
        'Rotation updated for the next recorded contact.',
      )
    )
      this.closeSheet();
  }

  async saveNote(): Promise<void> {
    if (!this.noteText.trim()) return;
    const scope = {
      sessionId: this.store.activeSession()?.id,
      ...(this.noteScope === 'player' ? { playerId: this.current()?.id } : {}),
      ...(this.noteScope === 'event'
        ? { eventId: this.latest()?.id, playerId: this.latest()?.playerId }
        : {}),
    };
    if (
      await this.action(
        () => this.store.addNote(scope, this.noteText.trim()),
        'Coaching note saved.',
      )
    )
      this.closeSheet();
  }

  async finish(): Promise<void> {
    const session = this.store.activeSession();
    if (session && (await this.action(() => this.store.finishSession(session.id)))) {
      this.closeSheet();
      await this.router.navigate(['/reports'], { queryParams: { session: session.id } });
    }
  }

  listen(): void {
    if (this.listening()) {
      this.speech?.abort();
      this.listening.set(false);
      return;
    }
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechConstructor;
      webkitSpeechRecognition?: SpeechConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    this.openSheet('players');
    if (!Recognition) {
      this.message.set(
        'Voice selection is unavailable in this browser. Find a hitter by name or number below.',
      );
      return;
    }
    this.speech = new Recognition();
    this.speech.lang = this.i18n.currentLang() === 'es' ? 'es-419' : navigator.language || 'en-US';
    this.speech.interimResults = false;
    this.speech.continuous = false;
    this.speech.onresult = (event) => {
      const result = event.results[0][0];
      const matches = findSpokenPlayers(this.store.roster(), result.transcript);
      this.listening.set(false);
      if (matches.length === 1 && result.confidence >= 0.75) {
        void this.select(matches[0].id);
        return;
      }
      this.voiceMatches.set(matches.length ? matches : null);
      this.message.set(
        matches.length
          ? `Heard “${result.transcript}”. Choose the hitter below.`
          : `Heard “${result.transcript}”. Search for a name or jersey number below.`,
      );
    };
    this.speech.onerror = () => {
      this.listening.set(false);
      this.message.set(
        'Voice could not connect or microphone access was unavailable. Select a hitter below.',
      );
    };
    this.speech.onend = () => this.listening.set(false);
    try {
      this.speech.start();
      this.listening.set(true);
      this.message.set('Listening. Say a player’s name or jersey number.');
    } catch {
      this.listening.set(false);
      this.message.set('Voice is unavailable right now. Select a hitter below.');
    }
  }
}

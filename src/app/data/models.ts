export const SCHEMA_VERSION = 1 as const;
export const APP_VERSION = '1.0.0';
export type Hand = 'L' | 'R' | 'S';
export type PitcherHand = 'L' | 'R' | null;
export type BatterSide = 'L' | 'R' | null;
export const CONTACT_TYPES = [
  'dribbler',
  'ground-ball',
  'line-drive',
  'pop-up',
  'fly-ball',
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];
export const HIT_RESULTS = ['out', 'single', 'double', 'triple', 'home-run'] as const;
export type HitResult = (typeof HIT_RESULTS)[number];
export const CONTACT_LABELS: Record<ContactType, string> = {
  dribbler: 'Dribbler',
  'ground-ball': 'Ground ball',
  'line-drive': 'Line drive',
  'pop-up': 'Pop up',
  'fly-ball': 'Fly ball',
};
export const RESULT_LABELS: Record<HitResult, string> = {
  out: 'Out',
  single: 'Single',
  double: 'Double',
  triple: 'Triple',
  'home-run': 'Home run',
};

export interface Entity {
  id: string;
  createdAt: string;
  updatedAt: string;
}
export interface Team extends Entity {
  name: string;
  shortName: string;
  season: string;
  notes: string;
}
export interface Player extends Entity {
  teamId: string;
  name: string;
  jerseyNumber: string;
  grade: string;
  bats: Hand;
  throws: Hand;
  positions: string[];
  notes: string;
  active: boolean;
  order: number;
}
export interface TurnState {
  queue: string[];
  currentTurn: number;
  turnContacts: number;
  nextSequence: number;
}
export interface CaptureUndo {
  eventId: string;
  before: TurnState;
  after: TurnState;
}
export interface PracticeSession extends Entity, TurnState {
  teamId: string;
  startedAt: string;
  endedAt: string | null;
  title: string;
  location: string;
  notes: string;
  participantIds: string[];
  rotationCount: number | null;
  pitcherHand: 'L' | 'R';
  undoStack: CaptureUndo[];
}
export interface BallEvent extends Entity {
  schemaVersion: 1;
  teamId: string;
  playerId: string;
  sessionId: string;
  timestamp: string;
  sequence: number;
  turnSequence: number;
  contactSequence: number;
  fieldX: number;
  fieldY: number;
  coordinateSystemVersion: 1;
  pitcherHand: PitcherHand;
  batterSide: BatterSide;
  contactType: ContactType | null;
  result: HitResult | null;
  notes: string;
  playerName: string;
  jerseyNumber: string;
}
export interface CoachNote extends Entity {
  teamId: string;
  playerId: string | null;
  sessionId: string | null;
  eventId: string | null;
  timestamp: string;
  text: string;
}
export interface AppSettings {
  id: 'preferences';
  activeTeamId: string | null;
  defaultPitcherHand: 'L' | 'R';
  rotationCount: number | null;
  haptics: boolean;
  updatedAt: string;
}
export interface BackupData {
  schemaVersion: 1;
  application: 'Baseball Coach Helper';
  applicationVersion: string;
  exportedAt: string;
  teams: Team[];
  players: Player[];
  sessions: PracticeSession[];
  events: BallEvent[];
  notes: CoachNote[];
  settings: AppSettings;
}
export interface ImportPreview {
  data: BackupData;
  counts: { teams: number; players: number; sessions: number; events: number; notes: number };
  conflicts: number;
  warnings: string[];
}
export interface RosterRow {
  name: string;
  jerseyNumber: string;
  bats: Hand;
  throws: Hand;
  grade: string;
  positions: string[];
}
export interface RosterPreview {
  rows: RosterRow[];
  errors: string[];
}
export interface EventFilters {
  teamId?: string;
  playerId?: string;
  playerIds?: string[];
  sessionId?: string;
  sessionIds?: string[];
  from?: string;
  to?: string;
  pitcherHand?: PitcherHand;
  contactType?: ContactType | null;
  result?: HitResult | null;
}
export const defaultSettings = (): AppSettings => ({
  id: 'preferences',
  activeTeamId: null,
  defaultPitcherHand: 'R',
  rotationCount: null,
  haptics: true,
  updatedAt: new Date().toISOString(),
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ReportsComponent } from './reports.component';
import { CoachStore } from '../data/coach-store';
import { AppSettings, CoachNote, defaultSettings, Team } from '../data/models';
import { signal } from '@angular/core';

describe('ReportsComponent - Coaching notes and legend shapes', () => {
  let component: ReportsComponent;
  let storeMock: {
    settings: ReturnType<typeof signal<AppSettings>>;
    activeTeam: ReturnType<typeof signal<Team | null>>;
    players: ReturnType<typeof signal>;
    sessions: ReturnType<typeof signal>;
    events: ReturnType<typeof signal>;
    notes: ReturnType<typeof signal<CoachNote[]>>;
    updateNote: ReturnType<typeof vi.fn>;
    deleteNote: ReturnType<typeof vi.fn>;
    addNote: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    storeMock = {
      settings: signal<AppSettings>({
        ...defaultSettings(),
        shapeMarkers: true,
        activeTeamId: 'team-1',
      }),
      activeTeam: signal<Team | null>({
        id: 'team-1',
        name: 'Wildcats',
        shortName: 'WILDCATS',
        season: '2026',
        notes: '',
        createdAt: '',
        updatedAt: '',
      }),
      players: signal([
        {
          id: 'player-1',
          name: 'Marcus Williams',
          teamId: 'team-1',
          order: 0,
          jerseyNumber: '12',
          bats: 'R',
          throws: 'R',
          positions: ['SS'],
          notes: '',
          active: true,
          createdAt: '',
          updatedAt: '',
        },
      ]),
      sessions: signal([]),
      events: signal([]),
      notes: signal<CoachNote[]>([
        {
          id: 'note-1',
          teamId: 'team-1',
          playerId: 'player-1',
          sessionId: null,
          eventId: null,
          timestamp: '2026-09-29T12:00:00.000Z',
          text: 'Focus on staying back on offspeed',
          createdAt: '2026-09-29T12:00:00.000Z',
          updatedAt: '2026-09-29T12:00:00.000Z',
        },
      ]),
      updateNote: vi.fn().mockResolvedValue(undefined),
      deleteNote: vi.fn().mockResolvedValue(undefined),
      addNote: vi.fn().mockResolvedValue({
        id: 'note-2',
        teamId: 'team-1',
        playerId: 'player-1',
        sessionId: null,
        eventId: null,
        timestamp: '2026-09-29T12:00:00.000Z',
        text: 'New note',
        createdAt: '',
        updatedAt: '',
      } satisfies CoachNote),
    };

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: CoachStore, useValue: storeMock }],
    });

    const fixture = TestBed.createComponent(ReportsComponent);
    component = fixture.componentInstance;
  });

  describe('legendShapeClass standard baseball idioms', () => {
    it('maps contact types to standard baseball idioms when shapeMarkers is enabled', () => {
      expect(component.legendShapeClass('dribbler')).toBe('shape-square');
      expect(component.legendShapeClass('ground-ball')).toBe('shape-square');
      expect(component.legendShapeClass('fly-ball')).toBe('shape-circle');
      expect(component.legendShapeClass('pop-up')).toBe('shape-circle');
      expect(component.legendShapeClass('line-drive')).toBe('shape-triangle');
    });

    it('returns shape-circle for all contact types when shapeMarkers is disabled', () => {
      storeMock.settings.set({
        ...defaultSettings(),
        shapeMarkers: false,
        activeTeamId: 'team-1',
      });

      expect(component.legendShapeClass('dribbler')).toBe('shape-circle');
      expect(component.legendShapeClass('ground-ball')).toBe('shape-circle');
      expect(component.legendShapeClass('fly-ball')).toBe('shape-circle');
      expect(component.legendShapeClass('pop-up')).toBe('shape-circle');
      expect(component.legendShapeClass('line-drive')).toBe('shape-circle');
    });
  });

  describe('coaching notes editing and deletion', () => {
    const testNote: CoachNote = {
      id: 'note-1',
      teamId: 'team-1',
      playerId: 'player-1',
      sessionId: null,
      eventId: null,
      timestamp: '2026-09-29T12:00:00.000Z',
      text: 'Focus on staying back on offspeed',
      createdAt: '2026-09-29T12:00:00.000Z',
      updatedAt: '2026-09-29T12:00:00.000Z',
    };

    it('enters and cancels editing a coaching note', () => {
      component.startEditNote(testNote);
      expect(component.editingNoteId).toBe('note-1');
      expect(component.editNoteText).toBe('Focus on staying back on offspeed');

      component.cancelEditNote();
      expect(component.editingNoteId).toBe('');
      expect(component.editNoteText).toBe('');
    });

    it('saves an edited coaching note through the store', async () => {
      component.startEditNote(testNote);
      component.editNoteText = 'Updated coaching cue: drive through the ball';

      await component.saveNoteEdit('note-1');

      expect(storeMock.updateNote).toHaveBeenCalledWith(
        'note-1',
        'Updated coaching cue: drive through the ball',
      );
      expect(component.editingNoteId).toBe('');
      expect(component.editNoteText).toBe('');
      expect(component.message()).toBe('Coaching note updated.');
    });

    it('prompts, confirms, and cancels deleting a coaching note', async () => {
      component.promptDeleteNote('note-1');
      expect(component.deleteNotePendingId).toBe('note-1');

      component.cancelDeleteNote();
      expect(component.deleteNotePendingId).toBe('');

      component.promptDeleteNote('note-1');
      await component.deleteNote('note-1');

      expect(storeMock.deleteNote).toHaveBeenCalledWith('note-1');
      expect(component.deleteNotePendingId).toBe('');
      expect(component.message()).toBe('Coaching note deleted.');
    });
  });
});

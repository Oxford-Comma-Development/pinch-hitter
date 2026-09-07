import { describe, expect, it } from 'vitest';
import { FieldComponent, FieldPoint, normalizeFieldPoint } from '../shared/field.component';
import { PracticeComponent, findSpokenPlayers } from './practice.component';
import { Player, BallEvent } from '../data/models';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CoachStore } from '../data/coach-store';

describe('Field coordinate capture', () => {
  it('suppresses near-identical double taps while allowing distinct taps and a later contact at the same spot', () => {
    const fixture = TestBed.createComponent(FieldComponent);
    fixture.componentRef.setInput('interactive', true);
    const field = fixture.componentInstance;
    const recorded: FieldPoint[] = [];
    field.location.subscribe((point) => recorded.push(point));
    const tap = (x: number, y: number, time: number) => {
      const event = {
        button: 0,
        pointerId: 1,
        clientX: x,
        clientY: y,
        timeStamp: time,
        currentTarget: {
          getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1000 }),
        },
      } as unknown as PointerEvent;
      field.beginTap(event);
      field.finishTap(event);
    };
    tap(100, 100, 1000);
    expect(recorded).toEqual([{ x: 0.1, y: 0.1 }]);
    tap(106, 105, 1200);
    expect(recorded).toHaveLength(1);
    tap(200, 100, 1210);
    expect(recorded).toHaveLength(2);
    tap(200, 100, 1461);
    expect(recorded).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.1 },
      { x: 0.2, y: 0.1 },
    ]);
  });

  it('keeps home plate coordinates identical across phone and tablet sizes', () => {
    for (const size of [280, 366, 700, 1000]) {
      const point = normalizeFieldPoint(12 + size * 0.5, 80 + size * 0.88, {
        left: 12,
        top: 80,
        width: size,
        height: size,
      });
      expect(point.x).toBeCloseTo(0.5);
      expect(point.y).toBeCloseTo(0.88);
    }
  });

  it('accounts for SVG letterboxing in a landscape container', () => {
    expect(normalizeFieldPoint(260, 128, { left: 10, top: 20, width: 500, height: 300 })).toEqual({
      x: 0.5,
      y: 0.36,
    });
    expect(normalizeFieldPoint(160, 278, { left: 10, top: 20, width: 300, height: 500 })).toEqual({
      x: 0.5,
      y: 158 / 300,
    });
  });

  it('clamps edges and safely handles an unmeasurable field', () => {
    expect(normalizeFieldPoint(-5, 120, { left: 0, top: 0, width: 100, height: 100 })).toEqual({
      x: 0,
      y: 1,
    });
    expect(normalizeFieldPoint(0, 0, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      x: 0.5,
      y: 0.5,
    });
  });
});

const makePlayer = (id: string, name: string, jerseyNumber: string): Player => ({
  id,
  name,
  jerseyNumber,
  teamId: 'team',
  grade: '',
  bats: 'R',
  throws: 'R',
  positions: [],
  notes: '',
  active: true,
  order: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});
const roster = [
  makePlayer('1', 'Marcus Jones', '7'),
  makePlayer('2', 'Marcus Lee', '12'),
  makePlayer('3', 'José Rivera', '3'),
];

describe('Voice-assisted hitter selection', () => {
  it('matches exact names regardless of case and accents', () => {
    expect(findSpokenPlayers(roster, 'JOSE RIVERA').map((player) => player.id)).toEqual(['3']);
  });
  it('finds spoken jersey numbers', () => {
    expect(findSpokenPlayers(roster, 'number twelve').map((player) => player.id)).toEqual(['2']);
    expect(findSpokenPlayers(roster, 'jersey 7').map((player) => player.id)).toEqual(['1']);
  });
  it('preserves ambiguous matches for a visible choice instead of guessing', () => {
    expect(findSpokenPlayers(roster, 'Marcus').map((player) => player.id)).toEqual(['1', '2']);
    expect(findSpokenPlayers(roster, 'unknown hitter')).toEqual([]);
    expect(findSpokenPlayers(roster, '')).toEqual([]);
  });
});

describe('Resuming practice', () => {
  it('identifies the most recent contact by sequence after IndexedDB loads records in UUID order', () => {
    const events = [3, 1, 2].map(
      (sequence) => ({ id: `event-${sequence}`, sessionId: 'session', sequence }) as BallEvent,
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: CoachStore,
          useValue: {
            ready: signal(false),
            events: signal(events),
            activeSession: signal({ id: 'session' }),
          },
        },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new PracticeComponent());
    expect(component.latest()?.id).toBe('event-3');
  });

  it('recovers a switch hitter’s last recorded side until the coach selects another', () => {
    const player = { ...makePlayer('player', 'Switch Hitter', '2'), bats: 'S' as const };
    const events = [
      { id: 'newer', sessionId: 'session', playerId: player.id, sequence: 2, batterSide: 'L' },
      { id: 'older', sessionId: 'session', playerId: player.id, sequence: 1, batterSide: 'R' },
    ] as BallEvent[];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: CoachStore,
          useValue: {
            ready: signal(false),
            events: signal(events),
            players: signal([player]),
            activeSession: signal({ id: 'session', queue: [player.id] }),
          },
        },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new PracticeComponent());
    expect(component.batterSide()).toBe('L');
    component.setSide('R');
    expect(component.batterSide()).toBe('R');
  });
});

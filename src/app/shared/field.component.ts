import { Component, computed, input, output, signal } from '@angular/core';
import { BallEvent } from '../data/models';

export interface FieldPoint {
  x: number;
  y: number;
}

/** Version 1: square SVG, top-left origin; home (0.5, 0.88), center field (0.5, 0.08). */
export function normalizeFieldPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): FieldPoint {
  const size = Math.min(rect.width, rect.height);
  if (size <= 0) return { x: 0.5, y: 0.5 };
  return {
    x: Math.max(0, Math.min(1, (clientX - rect.left - (rect.width - size) / 2) / size)),
    y: Math.max(0, Math.min(1, (clientY - rect.top - (rect.height - size) / 2) / size)),
  };
}

export const CONTACT_COLORS: Record<string, string> = {
  dribbler: '#fff2bc',
  'ground-ball': '#ffc24a',
  'line-drive': '#f07140',
  'pop-up': '#a8dcfc',
  'fly-ball': '#d9b6ff',
  unclassified: '#ffffff',
};
export const RESULT_COLORS: Record<string, string> = {
  out: '#ffc6c2',
  single: '#fff2bc',
  double: '#ffc24a',
  triple: '#a8dcfc',
  'home-run': '#d9b6ff',
  unclassified: '#ffffff',
};
export const HARD_HIT_COLORS: Record<string, string> = {
  '0': '#7f8c8d',
  '1': '#fff2bc',
  '2': '#fed368',
  '3': '#ff9f43',
  '4': '#ee5253',
  '5': '#d980fa',
  unclassified: '#ffffff',
};

@Component({
  selector: 'app-field',
  template: `
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid meet"
      [class.capture]="interactive()"
      [attr.role]="interactive() ? 'button' : 'img'"
      [attr.tabindex]="interactive() ? 0 : null"
      [attr.aria-label]="label()"
      (pointerdown)="beginTap($event)"
      (pointerup)="finishTap($event)"
      (keydown)="onKey($event)"
      (blur)="keyboardActive.set(false)"
    >
      <title>{{ label() }}</title>
      <desc>
        View from behind home plate. Left field is on the left, center field at the top, right field
        on the right.
        {{
          interactive()
            ? 'Tap to record a location. With a keyboard, move the crosshair with arrow keys and press Enter.'
            : 'Select an observation in the chart or event history for details.'
        }}
      </desc>
      <defs>
        <clipPath [id]="clipId">
          <path d="M 500 880 L 64 444 C 131 -44 869 -44 936 444 Z" />
        </clipPath>
        <radialGradient [id]="heatId">
          <stop offset="0" stop-color="#ff582c" stop-opacity=".88" />
          <stop offset=".4" stop-color="#ffb433" stop-opacity=".65" />
          <stop offset="1" stop-color="#ffec8b" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1000" height="1000" rx="28" fill="#173f36" />
      <path d="M 500 880 L 64 444 C 131 -44 869 -44 936 444 Z" fill="#37734c" />
      <g [attr.clip-path]="'url(#' + clipId + ')'" opacity=".2" fill="#a3c977">
        <path d="M0 80H1000V180H0z M0 280H1000V380H0z M0 480H1000V580H0z M0 680H1000V780H0z" />
      </g>
      <path d="M64 444 C131 -44 869 -44 936 444" fill="none" stroke="#c7b78c" stroke-width="20" />
      <path d="M64 444 C131 -44 869 -44 936 444" fill="none" stroke="#fff4d3" stroke-width="3" />
      <path d="M 500 880 L 277 657 Q 500 383 723 657 Z" fill="#bf9769" />
      <path d="M500 829L357 686L500 543L643 686Z" fill="#448052" />
      <path d="M42 422L500 880L958 422" fill="none" stroke="#fff9df" stroke-width="5" />
      <path d="M500 880L330 710L500 540L670 710Z" fill="none" stroke="#fbebc5" stroke-width="3" />
      <circle cx="500" cy="716" r="32" fill="#cda478" />
      <path d="M485 714H515" stroke="#fff9ec" stroke-width="7" />
      <g fill="#fff9e8" stroke="#987b53" stroke-width="2">
        <path d="M500 871L513 879V891H487V879Z" />
        <path d="M330 698L342 710L330 722L318 710Z" />
        <path d="M500 528L512 540L500 552L488 540Z" />
        <path d="M670 698L682 710L670 722L658 710Z" />
      </g>
      <path
        d="M457 866H477V902H457Z M523 866H543V902H523Z"
        fill="none"
        stroke="#e8e6d3"
        stroke-width="2"
      />
      <g
        fill="#f7f4db"
        opacity=".8"
        font-family="system-ui, sans-serif"
        font-size="25"
        font-weight="600"
        text-anchor="middle"
        letter-spacing="4"
      >
        <text x="238" y="357">LF</text>
        <text x="500" y="236">CF</text>
        <text x="762" y="357">RF</text>
        <text x="500" y="962" font-size="21" letter-spacing="3">HOME</text>
      </g>
      @if (heat()) {
        @for (cell of density(); track cell.key) {
          <circle
            [attr.cx]="cell.x"
            [attr.cy]="cell.y"
            [attr.r]="55 + cell.strength * 45"
            [attr.fill]="'url(#' + heatId + ')'"
            [attr.opacity]="0.35 + cell.strength * 0.65"
          />
        }
      } @else {
        @for (event of events(); track event.id) {
          <g class="observation" [attr.data-event-id]="event.id">
            @if (event.id === selectedId()) {
              <path
                [attr.d]="'M500 880 L' + event.fieldX * 1000 + ' ' + event.fieldY * 1000"
                stroke="#fff9df"
                stroke-width="3"
                stroke-dasharray="9 8"
                opacity=".7"
              />
              <circle
                [attr.cx]="event.fieldX * 1000"
                [attr.cy]="event.fieldY * 1000"
                r="26"
                fill="none"
                stroke="#fff9df"
                stroke-width="5"
              />
            }
            @if (event.hardHit === 0) {
              <g
                [attr.transform]="
                  'translate(' + event.fieldX * 1000 + ',' + event.fieldY * 1000 + ')'
                "
              >
                <circle r="12" fill="#2d3436" stroke="#fff9df" stroke-width="2" />
                <path
                  d="M-6 -6 L6 6 M-6 6 L6 -6"
                  stroke="#ff7675"
                  stroke-width="2.5"
                  stroke-linecap="round"
                />
              </g>
            } @else {
              <circle
                [attr.cx]="event.fieldX * 1000"
                [attr.cy]="event.fieldY * 1000"
                [attr.r]="event.id === selectedId() ? 14 : 11"
                [attr.fill]="eventColor(event)"
                stroke="#142f2b"
                stroke-width="3"
              />
            }
            <circle
              [attr.cx]="event.fieldX * 1000"
              [attr.cy]="event.fieldY * 1000"
              r="23"
              fill="transparent"
            >
              <title>
                {{
                  event.hardHit === 0
                    ? 'Swing & miss (0)'
                    : (event.contactType || 'Location only') + ' · ' + (event.result || 'No result')
                }}
              </title>
            </circle>
          </g>
        }
      }
      @if (interactive() && keyboardActive()) {
        <g stroke="#fff" stroke-width="4" fill="none" pointer-events="none">
          <circle [attr.cx]="cursor().x * 1000" [attr.cy]="cursor().y * 1000" r="23" />
          <path
            [attr.d]="
              'M' +
              (cursor().x * 1000 - 36) +
              ' ' +
              cursor().y * 1000 +
              'h72 M' +
              cursor().x * 1000 +
              ' ' +
              (cursor().y * 1000 - 36) +
              'v72'
            "
          />
        </g>
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      aspect-ratio: 1;
      min-width: 0;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      user-select: none;
      -webkit-user-select: none;
    }
    svg.capture {
      cursor: crosshair;
      touch-action: manipulation;
    }
    svg:focus-visible {
      outline: 3px solid #d95525;
      outline-offset: 3px;
      border-radius: 12px;
    }
    .observation {
      cursor: pointer;
    }
    .capture .observation {
      pointer-events: none;
    }
  `,
})
export class FieldComponent {
  readonly events = input<BallEvent[]>([]);
  readonly selectedId = input('');
  readonly interactive = input(false);
  readonly heat = input(false);
  readonly colorBy = input<'contactType' | 'result' | 'hardHit'>('contactType');
  readonly label = input('Baseball spray chart');
  // This chart output carries coordinates; it does not refer to window.location.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly location = output<FieldPoint>();
  readonly selectEvent = output<string>();
  readonly keyboardActive = signal(false);
  readonly cursor = signal<FieldPoint>({ x: 0.5, y: 0.5 });
  private static nextId = 0;
  readonly clipId = `field-clip-${FieldComponent.nextId++}`;
  readonly heatId = `field-heat-${FieldComponent.nextId++}`;
  private pointerStart: { x: number; y: number; id: number } | null = null;
  private lastCapture: { x: number; y: number; time: number } | null = null;

  // Aggregate to a 40×40 grid so season-long density charts never add thousands of SVG nodes.
  readonly density = computed(() => {
    const cells = new Map<string, { key: string; x: number; y: number; count: number }>();
    for (const event of this.events()) {
      if (event.hardHit === 0) continue;
      const x = Math.min(39, Math.floor(event.fieldX * 40));
      const y = Math.min(39, Math.floor(event.fieldY * 40));
      const key = `${x},${y}`;
      const cell = cells.get(key) ?? { key, x: (x + 0.5) * 25, y: (y + 0.5) * 25, count: 0 };
      cell.count++;
      cells.set(key, cell);
    }
    const max = Math.max(1, ...Array.from(cells.values(), (cell) => cell.count));
    return Array.from(cells.values(), (cell) => ({ ...cell, strength: cell.count / max }));
  });

  eventColor(event: BallEvent): string {
    if (this.colorBy() === 'hardHit') {
      const key =
        event.hardHit !== null && event.hardHit !== undefined
          ? String(event.hardHit)
          : 'unclassified';
      return HARD_HIT_COLORS[key] || HARD_HIT_COLORS['unclassified'];
    }
    return (this.colorBy() === 'result' ? RESULT_COLORS : CONTACT_COLORS)[
      (event[this.colorBy()] as string) || 'unclassified'
    ];
  }

  beginTap(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }

  finishTap(event: PointerEvent): void {
    const start = this.pointerStart;
    this.pointerStart = null;
    if (
      !start ||
      start.id !== event.pointerId ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 14
    )
      return;
    if (this.interactive()) {
      // Ignore an accidental double tap without delaying the first or distinct locations.
      const last = this.lastCapture;
      if (
        last &&
        event.timeStamp - last.time <= 250 &&
        Math.hypot(event.clientX - last.x, event.clientY - last.y) <= 14
      )
        return;
      this.lastCapture = { x: event.clientX, y: event.clientY, time: event.timeStamp };
      const svg = event.currentTarget as SVGSVGElement;
      this.location.emit(
        normalizeFieldPoint(event.clientX, event.clientY, svg.getBoundingClientRect()),
      );
    } else {
      const id = (event.target as Element)
        .closest('[data-event-id]')
        ?.getAttribute('data-event-id');
      if (id) this.selectEvent.emit(id);
    }
  }

  onKey(event: KeyboardEvent): void {
    if (!this.interactive()) return;
    const direction: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (direction[event.key]) {
      event.preventDefault();
      this.keyboardActive.set(true);
      const [dx, dy] = direction[event.key];
      const step = event.shiftKey ? 0.1 : 0.025;
      this.cursor.update(({ x, y }) => ({
        x: Math.max(0, Math.min(1, x + dx * step)),
        y: Math.max(0, Math.min(1, y + dy * step)),
      }));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.keyboardActive.set(true);
      this.location.emit(this.cursor());
    }
  }
}

import { Component, computed, input, output, signal } from '@angular/core';
import { BallEvent, ColorPaletteMode, FieldThemeMode } from '../data/models';

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
  '5': '#b53471',
  '6': '#d980fa',
  unclassified: '#ffffff',
};

// Okabe-Ito barrier-free color palette (universally distinguishable across CVD types)
export const OKABE_ITO_CONTACT_COLORS: Record<string, string> = {
  dribbler: '#f0e442', // Yellow
  'ground-ball': '#e69f00', // Orange
  'line-drive': '#d55e00', // Vermilion
  'pop-up': '#56b4e9', // Sky Blue
  'fly-ball': '#cc79a7', // Reddish Purple
  unclassified: '#ffffff',
};
export const OKABE_ITO_RESULT_COLORS: Record<string, string> = {
  out: '#2c3437', // Dark Charcoal
  single: '#f0e442', // Yellow
  double: '#e69f00', // Orange
  triple: '#56b4e9', // Sky Blue
  'home-run': '#cc79a7', // Reddish Purple
  unclassified: '#ffffff',
};
export const OKABE_ITO_HARD_HIT_COLORS: Record<string, string> = {
  '0': '#000000', // Black
  '1': '#f0e442', // Yellow
  '2': '#e69f00', // Orange
  '3': '#56b4e9', // Sky Blue
  '4': '#0072b2', // Deep Blue
  '5': '#d55e00', // Vermilion
  '6': '#cc79a7', // Reddish Purple
  unclassified: '#ffffff',
};

// High contrast palette (maximized luminance contrast for harsh sunlight)
export const HIGH_CONTRAST_CONTACT_COLORS: Record<string, string> = {
  dribbler: '#ffeb3b', // Bright Yellow
  'ground-ball': '#ff9800', // Deep Amber
  'line-drive': '#ff3d00', // Bright Vermilion
  'pop-up': '#00e5ff', // Electric Cyan
  'fly-ball': '#e040fb', // Neon Purple
  unclassified: '#ffffff',
};
export const HIGH_CONTRAST_RESULT_COLORS: Record<string, string> = {
  out: '#1e293b', // Deep Slate
  single: '#ffeb3b',
  double: '#ff9800',
  triple: '#00e5ff',
  'home-run': '#e040fb',
  unclassified: '#ffffff',
};
export const HIGH_CONTRAST_HARD_HIT_COLORS: Record<string, string> = {
  '0': '#000000',
  '1': '#ffeb3b',
  '2': '#ff9800',
  '3': '#00e5ff',
  '4': '#2979ff',
  '5': '#ff3d00',
  '6': '#e040fb',
  unclassified: '#ffffff',
};

@Component({
  selector: 'app-field',
  template: `
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid meet"
      [class.capture]="interactive()"
      [class.high-contrast-field]="theme() === 'high_contrast'"
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
          @if (palette() !== 'standard') {
            <stop offset="0" stop-color="#d55e00" stop-opacity=".95" />
            <stop offset=".4" stop-color="#56b4e9" stop-opacity=".75" />
            <stop offset="1" stop-color="#f0e442" stop-opacity="0" />
          } @else {
            <stop offset="0" stop-color="#ff582c" stop-opacity=".88" />
            <stop offset=".4" stop-color="#ffb433" stop-opacity=".65" />
            <stop offset="1" stop-color="#ffec8b" stop-opacity="0" />
          }
        </radialGradient>
      </defs>
      <rect
        width="1000"
        height="1000"
        rx="28"
        [attr.fill]="theme() === 'high_contrast' ? '#080d14' : '#173f36'"
      />
      <path
        d="M 500 880 L 64 444 C 131 -44 869 -44 936 444 Z"
        [attr.fill]="theme() === 'high_contrast' ? '#0f172a' : '#37734c'"
      />
      <g
        [attr.clip-path]="'url(#' + clipId + ')'"
        [attr.opacity]="theme() === 'high_contrast' ? '.12' : '.2'"
        [attr.fill]="theme() === 'high_contrast' ? '#334155' : '#a3c977'"
      >
        <path d="M0 80H1000V180H0z M0 280H1000V380H0z M0 480H1000V580H0z M0 680H1000V780H0z" />
      </g>
      <path
        d="M64 444 C131 -44 869 -44 936 444"
        fill="none"
        [attr.stroke]="theme() === 'high_contrast' ? '#334155' : '#c7b78c'"
        stroke-width="20"
      />
      <path
        d="M64 444 C131 -44 869 -44 936 444"
        fill="none"
        [attr.stroke]="theme() === 'high_contrast' ? '#38bdf8' : '#fff4d3'"
        [attr.stroke-width]="theme() === 'high_contrast' ? '4' : '3'"
      />
      <path
        d="M 500 880 L 277 657 Q 500 383 723 657 Z"
        [attr.fill]="theme() === 'high_contrast' ? '#1e293b' : '#bf9769'"
      />
      <path
        d="M500 829L357 686L500 543L643 686Z"
        [attr.fill]="theme() === 'high_contrast' ? '#0f172a' : '#448052'"
      />
      <path
        d="M42 422L500 880L958 422"
        fill="none"
        [attr.stroke]="theme() === 'high_contrast' ? '#ffffff' : '#fff9df'"
        [attr.stroke-width]="theme() === 'high_contrast' ? '6' : '5'"
      />
      <path
        d="M500 880L330 710L500 540L670 710Z"
        fill="none"
        [attr.stroke]="theme() === 'high_contrast' ? '#ffffff' : '#fbebc5'"
        [attr.stroke-width]="theme() === 'high_contrast' ? '4' : '3'"
      />
      <circle
        cx="500"
        cy="716"
        r="32"
        [attr.fill]="theme() === 'high_contrast' ? '#334155' : '#cda478'"
      />
      <path
        d="M485 714H515"
        [attr.stroke]="theme() === 'high_contrast' ? '#ffffff' : '#fff9ec'"
        stroke-width="7"
      />
      <g
        [attr.fill]="theme() === 'high_contrast' ? '#ffffff' : '#fff9e8'"
        [attr.stroke]="theme() === 'high_contrast' ? '#000000' : '#987b53'"
        [attr.stroke-width]="theme() === 'high_contrast' ? '3' : '2'"
      >
        <path d="M500 871L513 879V891H487V879Z" />
        <path d="M330 698L342 710L330 722L318 710Z" />
        <path d="M500 528L512 540L500 552L488 540Z" />
        <path d="M670 698L682 710L670 722L658 710Z" />
      </g>
      <path
        d="M457 866H477V902H457Z M523 866H543V902H523Z"
        fill="none"
        [attr.stroke]="theme() === 'high_contrast' ? '#ffffff' : '#e8e6d3'"
        [attr.stroke-width]="theme() === 'high_contrast' ? '3' : '2'"
      />
      <g
        [attr.fill]="theme() === 'high_contrast' ? '#ffffff' : '#f7f4db'"
        [attr.opacity]="theme() === 'high_contrast' ? '1' : '.8'"
        font-family="system-ui, sans-serif"
        font-size="25"
        font-weight="700"
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
                [attr.stroke]="theme() === 'high_contrast' ? '#38bdf8' : '#fff9df'"
                stroke-width="3"
                stroke-dasharray="9 8"
                opacity=".85"
              />
              <circle
                [attr.cx]="event.fieldX * 1000"
                [attr.cy]="event.fieldY * 1000"
                r="26"
                fill="none"
                [attr.stroke]="theme() === 'high_contrast' ? '#38bdf8' : '#fff9df'"
                stroke-width="5"
              />
            }
            @if (event.hardHit === 0) {
              <g
                [attr.transform]="
                  'translate(' + event.fieldX * 1000 + ',' + event.fieldY * 1000 + ')'
                "
              >
                <circle
                  r="12"
                  [attr.fill]="theme() === 'high_contrast' ? '#000000' : '#2d3436'"
                  [attr.stroke]="theme() === 'high_contrast' ? '#ffffff' : '#fff9df'"
                  stroke-width="2"
                />
                <path
                  d="M-6 -6 L6 6 M-6 6 L6 -6"
                  [attr.stroke]="palette() !== 'standard' ? '#ffffff' : '#ff7675'"
                  stroke-width="2.5"
                  stroke-linecap="round"
                />
              </g>
            } @else {
              @switch (markerShape(event)) {
                @case ('cross') {
                  <g
                    [attr.transform]="
                      'translate(' + event.fieldX * 1000 + ',' + event.fieldY * 1000 + ')'
                    "
                  >
                    <circle
                      r="12"
                      [attr.fill]="eventColor(event)"
                      [attr.stroke]="markerStroke(event)"
                      stroke-width="3"
                    />
                    <path
                      d="M-5 -5 L5 5 M-5 5 L5 -5"
                      stroke="#ffffff"
                      stroke-width="2.5"
                      stroke-linecap="round"
                    />
                  </g>
                }
                @case ('small-circle') {
                  <circle
                    [attr.cx]="event.fieldX * 1000"
                    [attr.cy]="event.fieldY * 1000"
                    r="8"
                    [attr.fill]="eventColor(event)"
                    [attr.stroke]="markerStroke(event)"
                    stroke-width="2.5"
                  />
                }
                @case ('diamond') {
                  <polygon
                    [attr.transform]="
                      'translate(' + event.fieldX * 1000 + ',' + event.fieldY * 1000 + ')'
                    "
                    points="0,-14 14,0 0,14 -14,0"
                    [attr.fill]="eventColor(event)"
                    [attr.stroke]="markerStroke(event)"
                    stroke-width="3"
                  />
                }
                @case ('triangle-up') {
                  <polygon
                    [attr.transform]="
                      'translate(' + event.fieldX * 1000 + ',' + event.fieldY * 1000 + ')'
                    "
                    points="0,-15 13,10 -13,10"
                    [attr.fill]="eventColor(event)"
                    [attr.stroke]="markerStroke(event)"
                    stroke-width="3"
                  />
                }
                @case ('triangle-down') {
                  <polygon
                    [attr.transform]="
                      'translate(' + event.fieldX * 1000 + ',' + event.fieldY * 1000 + ')'
                    "
                    points="0,15 13,-10 -13,-10"
                    [attr.fill]="eventColor(event)"
                    [attr.stroke]="markerStroke(event)"
                    stroke-width="3"
                  />
                }
                @case ('star') {
                  <polygon
                    [attr.transform]="
                      'translate(' + event.fieldX * 1000 + ',' + event.fieldY * 1000 + ')'
                    "
                    points="0,-15 4.5,-4.5 15,-4.5 6.5,2.5 10,14 0,7 -10,14 -6.5,2.5 -15,-4.5 -4.5,-4.5"
                    [attr.fill]="eventColor(event)"
                    [attr.stroke]="markerStroke(event)"
                    stroke-width="2.5"
                  />
                }
                @case ('square') {
                  <rect
                    [attr.transform]="
                      'translate(' + event.fieldX * 1000 + ',' + event.fieldY * 1000 + ')'
                    "
                    x="-11"
                    y="-11"
                    width="22"
                    height="22"
                    rx="3"
                    [attr.fill]="eventColor(event)"
                    [attr.stroke]="markerStroke(event)"
                    stroke-width="3"
                  />
                }
                @default {
                  <circle
                    [attr.cx]="event.fieldX * 1000"
                    [attr.cy]="event.fieldY * 1000"
                    [attr.r]="event.id === selectedId() ? 14 : 11"
                    [attr.fill]="eventColor(event)"
                    [attr.stroke]="markerStroke(event)"
                    stroke-width="3"
                  />
                }
              }
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
    @media print {
      svg.high-contrast-field {
        filter: invert(1) hue-rotate(180deg);
      }
    }
  `,
})
export class FieldComponent {
  readonly events = input<BallEvent[]>([]);
  readonly selectedId = input('');
  readonly interactive = input(false);
  readonly heat = input(false);
  readonly colorBy = input<'contactType' | 'result' | 'hardHit'>('contactType');
  readonly palette = input<ColorPaletteMode>('standard');
  readonly theme = input<FieldThemeMode>('classic');
  readonly shapeMarkers = input(false);
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
    const isCvd = this.palette() === 'colorblind';
    const isHc = this.palette() === 'high_contrast';
    if (this.colorBy() === 'hardHit') {
      const key =
        event.hardHit !== null && event.hardHit !== undefined
          ? String(event.hardHit)
          : 'unclassified';
      const map = isHc
        ? HIGH_CONTRAST_HARD_HIT_COLORS
        : isCvd
          ? OKABE_ITO_HARD_HIT_COLORS
          : HARD_HIT_COLORS;
      return map[key] || map['unclassified'];
    }
    const isResult = this.colorBy() === 'result';
    const val = (event[this.colorBy()] as string) || 'unclassified';
    const map = isHc
      ? isResult
        ? HIGH_CONTRAST_RESULT_COLORS
        : HIGH_CONTRAST_CONTACT_COLORS
      : isCvd
        ? isResult
          ? OKABE_ITO_RESULT_COLORS
          : OKABE_ITO_CONTACT_COLORS
        : isResult
          ? RESULT_COLORS
          : CONTACT_COLORS;
    return map[val] || map['unclassified'];
  }

  markerStroke(event: BallEvent): string {
    if (this.theme() === 'high_contrast') {
      if (event.hardHit === 0 || (this.colorBy() === 'result' && event.result === 'out')) {
        return '#ffffff';
      }
      return '#000000';
    }
    return '#142f2b';
  }

  markerShape(
    event: BallEvent,
  ):
    | 'circle'
    | 'small-circle'
    | 'diamond'
    | 'triangle-up'
    | 'triangle-down'
    | 'cross'
    | 'star'
    | 'square' {
    if (!this.shapeMarkers()) return 'circle';
    if (this.colorBy() === 'result') {
      switch (event.result) {
        case 'out':
          return 'cross';
        case 'single':
          return 'circle';
        case 'double':
          return 'diamond';
        case 'triple':
          return 'triangle-up';
        case 'home-run':
          return 'star';
        default:
          return 'circle';
      }
    }
    if (this.colorBy() === 'hardHit') {
      switch (event.hardHit) {
        case 1:
        case 2:
          return 'circle';
        case 3:
          return 'triangle-up';
        case 4:
          return 'diamond';
        case 5:
          return 'square';
        case 6:
          return 'star';
        default:
          return 'circle';
      }
    }
    switch (event.contactType) {
      case 'dribbler':
        return 'small-circle';
      case 'ground-ball':
        return 'circle';
      case 'line-drive':
        return 'diamond';
      case 'fly-ball':
        return 'triangle-up';
      case 'pop-up':
        return 'triangle-down';
      default:
        return 'circle';
    }
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

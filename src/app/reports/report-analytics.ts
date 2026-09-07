import { BallEvent } from '../data/models';
import { summarizeEvents } from '../data/domain';

export function percent(count: number, denominator: number): string {
  return denominator ? `${Math.round((count / denominator) * 100)}%` : '—';
}

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function periodDates(days: number, now = new Date()): { from: string; through: string } {
  const firstDay = new Date(now);
  firstDay.setDate(firstDay.getDate() - days + 1);
  return { from: localDate(firstDay), through: localDate(now) };
}

/** Inclusive local calendar dates, including short/long DST days. */
export function dateBoundaries(from: string, through: string): { from?: string; to?: string } {
  return {
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: through ? new Date(`${through}T23:59:59.999`).toISOString() : undefined,
  };
}

export function recentComparison(events: readonly BallEvent[], now = new Date()) {
  const dates = periodDates(14, now);
  const start = new Date(`${dates.from}T00:00:00`).getTime();
  const end = new Date(`${dates.through}T23:59:59.999`).getTime();
  const recent = events.filter((event) => {
    const time = new Date(event.timestamp).getTime();
    return time >= start && time <= end;
  });
  return { recent: summarizeEvents(recent), season: summarizeEvents(events), dates };
}

import { BallEvent } from '../data/models';
import { dateBoundaries, percent, periodDates, recentComparison } from './report-analytics';

describe('report calendar periods and comparisons', () => {
  it('includes today as one of the selected days across month boundaries', () => {
    expect(periodDates(7, new Date(2026, 8, 2, 15))).toEqual({
      from: '2026-08-27',
      through: '2026-09-02',
    });
  });

  it('uses the full local day for both inclusive filter boundaries', () => {
    const range = dateBoundaries('2026-09-01', '2026-09-02');
    expect(new Date(range.from!).getHours()).toBe(0);
    expect(new Date(range.to!).getHours()).toBe(23);
    expect(new Date(range.to!).getMilliseconds()).toBe(999);
    expect(dateBoundaries('', '')).toEqual({ from: undefined, to: undefined });
  });

  it('compares recent observations to season with separate contact/result denominators', () => {
    const event = (
      timestamp: string,
      contactType: BallEvent['contactType'],
      result: BallEvent['result'],
    ) =>
      ({
        timestamp,
        contactType,
        result,
        fieldX: 0.3,
        fieldY: 0.4,
        batterSide: 'R',
        pitcherHand: 'R',
        playerId: 'a',
        sessionId: 's',
      }) as BallEvent;
    const comparison = recentComparison(
      [
        event('2026-08-01T12:00:00', 'ground-ball', 'out'),
        event('2026-08-31T12:00:00', 'line-drive', null),
        event('2026-09-01T12:00:00', null, 'single'),
        event('2026-09-02T12:00:00', null, null),
      ],
      new Date(2026, 8, 2, 15),
    );
    expect(comparison.recent.total).toBe(3);
    expect(comparison.season.total).toBe(4);
    expect(comparison.recent.classifiedContacts).toBe(1);
    expect(comparison.recent.classifiedResults).toBe(1);
    expect(
      percent(comparison.recent.contacts['line-drive'], comparison.recent.classifiedContacts),
    ).toBe('100%');
    expect(
      percent(comparison.season.contacts['line-drive'], comparison.season.classifiedContacts),
    ).toBe('50%');
  });

  it('does not turn missing classifications into fabricated zero-percent conclusions', () => {
    expect(percent(0, 0)).toBe('—');
    expect(recentComparison([]).recent.classifiedContacts).toBe(0);
  });
});

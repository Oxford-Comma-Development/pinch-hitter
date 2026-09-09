import { describe, expect, it } from 'vitest';
import { CoachRepository, DATABASE_NAME, LEGACY_DATABASE_NAME } from './repository';

describe('CoachRepository migration logic', () => {
  it('defines DATABASE_NAME as pinch-hitter and LEGACY_DATABASE_NAME as baseball-coach-helper', () => {
    expect(DATABASE_NAME).toBe('pinch-hitter');
    expect(LEGACY_DATABASE_NAME).toBe('baseball-coach-helper');
  });

  it('initializes with default databaseName', () => {
    const repo = new CoachRepository();
    expect(repo).toBeDefined();
  });
});

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { I18nService } from './i18n.service';
import { CoachStore } from '../data/coach-store';
import { en } from './dictionaries/en';
import { es } from './dictionaries/es';

describe('I18nService & Dictionaries', () => {
  let service: I18nService;
  let store: CoachStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(CoachStore);
    service = TestBed.inject(I18nService);
  });

  it('maintains 100% key parity between English and Spanish dictionaries', () => {
    const enKeys = Object.keys(en).sort();
    const esKeys = Object.keys(es).sort();

    const missingInEs = enKeys.filter((k) => !(k in es));
    const extraInEs = esKeys.filter((k) => !(k in en));

    expect(missingInEs).toEqual([]);
    expect(extraInEs).toEqual([]);
    expect(esKeys.length).toBe(enKeys.length);
  });

  it('interpolates parameters correctly', () => {
    expect(service.t('practice.turnCount', { count: 4 })).toBe('4 this turn');
    expect(service.t('practice.turnLimit', { count: 2, limit: 5 })).toBe('2 / 5');
  });

  it('chooses singular and plural forms by count in both languages', () => {
    expect(service.t('backup.practices', { count: 1 })).toBe('1 practice');
    expect(service.t('backup.practices', { count: 2 })).toBe('2 practices');
    expect(service.t('backup.practices', { count: 0 })).toBe('0 practices');
    store.settings.update((s) => ({ ...s, language: 'es' }));
    expect(service.t('backup.practices', { count: 1 })).toBe('1 práctica');
    expect(service.t('roster.addCountPlayers', { count: 3 })).toBe('Añadir 3 peloteros');
  });

  it('inserts parameter values literally, even ones that look like replacement patterns', () => {
    expect(service.t('home.logoAlt', { team: 'Cash $& Carry' })).toBe('Cash $& Carry logo');
  });

  it('formats dates with Spanish month and weekday names in Spanish mode', () => {
    const date = new Date(2026, 9, 8, 15, 5);
    expect(service.date(date, 'MMM')).toBe('Oct');
    expect(service.date(date, 'date.monthDayYear')).toBe('Oct 8, 2026');
    store.settings.update((s) => ({ ...s, language: 'es' }));
    expect(service.date(date, 'MMM')).toBe('oct');
    expect(service.date(date, 'EEE')).toBe('jue');
    expect(service.date(date, 'date.monthDayYear')).toBe('8 oct 2026');
  });

  it('words the unbacked-work summary from counts in the coach’s language', () => {
    const work = {
      hasSubstantialWork: true,
      unbackedSessions: 1,
      unbackedEvents: 14,
      unbackedPlayers: 0,
      neverBackedUp: false,
    };
    expect(service.unbackedSummary(work)).toBe(
      '1 new practice and 14 new contacts recorded since your last backup',
    );
    expect(service.unbackedSummary({ ...work, unbackedSessions: 0, neverBackedUp: true })).toBe(
      '14 contacts not yet backed up on this device',
    );
    store.settings.update((s) => ({ ...s, language: 'es' }));
    expect(service.unbackedSummary(work)).toBe(
      '1 práctica nueva y 14 contactos nuevos desde tu último respaldo',
    );
  });

  it('falls back to key if translation is not found in any dictionary', () => {
    expect(service.t('nonexistent.fake.key')).toBe('nonexistent.fake.key');
  });

  it('switches between English and Spanish reactively', async () => {
    expect(service.currentLang()).toBe('en');
    expect(service.t('practice.nextBatter')).toBe('Next batter');
    expect(service.contactLabels()['ground-ball']).toBe('Ground ball');
    expect(service.hardHitShortLabels()[5]).toBe('5 Crushed');
    expect(service.hardHitShortLabels()[6]).toBe('6 Plákata');

    // Switch to Spanish via store settings signal
    store.settings.update((s) => ({ ...s, language: 'es' }));

    expect(service.currentLang()).toBe('es');
    expect(service.t('practice.nextBatter')).toBe('Siguiente');
    expect(service.contactLabels()['ground-ball']).toBe('Rolata');
    expect(service.contactLabels()['line-drive']).toBe('Línea');
    expect(service.contactLabels()['fly-ball']).toBe('Elevado');
    expect(service.resultLabels()['home-run']).toBe('Jonrón');
    expect(service.hardHitShortLabels()[0]).toBe('0 Fallo');
    expect(service.hardHitShortLabels()[5]).toBe('5 Palazo');
    expect(service.hardHitShortLabels()[6]).toBe('6 Plákata');
    expect(service.directionLabels().pull).toBe('A su banda');
  });
});

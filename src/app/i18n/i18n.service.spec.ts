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

  it('falls back to key if translation is not found in any dictionary', () => {
    expect(service.t('nonexistent.fake.key')).toBe('nonexistent.fake.key');
  });

  it('switches between English and Spanish reactively', async () => {
    expect(service.currentLang()).toBe('en');
    expect(service.t('practice.nextBatter')).toBe('Next batter');
    expect(service.contactLabels()['ground-ball']).toBe('Ground ball');
    expect(service.hardHitShortLabels()[5]).toBe('5 Plákata');

    // Switch to Spanish via store settings signal
    store.settings.update((s) => ({ ...s, language: 'es' }));

    expect(service.currentLang()).toBe('es');
    expect(service.t('practice.nextBatter')).toBe('Siguiente');
    expect(service.contactLabels()['ground-ball']).toBe('Rolata');
    expect(service.contactLabels()['line-drive']).toBe('Línea');
    expect(service.contactLabels()['fly-ball']).toBe('Elevado');
    expect(service.resultLabels()['home-run']).toBe('Jonrón');
    expect(service.hardHitShortLabels()[0]).toBe('0 Fallo');
    expect(service.hardHitShortLabels()[5]).toBe('5 Plákata');
    expect(service.directionLabels().pull).toBe('A su banda');
  });
});

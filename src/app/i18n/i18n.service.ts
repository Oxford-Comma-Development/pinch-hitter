import { computed, inject, Injectable, Signal } from '@angular/core';
import { CoachStore } from '../data/coach-store';
import { AppLanguage, ContactType, Hand, HardHitRating, HitResult } from '../data/models';
import { en } from './dictionaries/en';
import { es } from './dictionaries/es';
import { TranslationDictionary } from './i18n.types';

const DICTIONARIES: Record<AppLanguage, TranslationDictionary> = {
  en,
  es,
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly store = inject(CoachStore);

  readonly currentLang: Signal<AppLanguage> = computed(() => {
    return this.store.settings().language ?? 'en';
  });

  readonly isSpanish: Signal<boolean> = computed(() => this.currentLang() === 'es');

  t(key: string, params?: Record<string, string | number>): string {
    const lang = this.currentLang();
    const dictionary = DICTIONARIES[lang] ?? DICTIONARIES.en;
    let text = dictionary[key] ?? DICTIONARIES.en[key] ?? key;

    if (params) {
      for (const [paramKey, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
      }
    }

    return text;
  }

  readonly contactLabels: Signal<Record<ContactType, string>> = computed(() => ({
    dribbler: this.t('baseball.dribbler'),
    'ground-ball': this.t('baseball.groundBall'),
    'line-drive': this.t('baseball.lineDrive'),
    'pop-up': this.t('baseball.popUp'),
    'fly-ball': this.t('baseball.flyBall'),
  }));

  readonly resultLabels: Signal<Record<HitResult, string>> = computed(() => ({
    out: this.t('baseball.out'),
    single: this.t('baseball.single'),
    double: this.t('baseball.double'),
    triple: this.t('baseball.triple'),
    'home-run': this.t('baseball.homeRun'),
  }));

  readonly hardHitLabels: Signal<Record<HardHitRating, string>> = computed(() => ({
    0: this.t('baseball.miss'),
    1: this.t('baseball.weak'),
    2: this.t('baseball.soft'),
    3: this.t('baseball.medium'),
    4: this.t('baseball.hard'),
    5: this.t('baseball.crushed'),
    6: this.t('baseball.plakata'),
  }));

  readonly hardHitShortLabels: Signal<Record<HardHitRating, string>> = computed(() => ({
    0: this.t('baseball.shortMiss'),
    1: this.t('baseball.shortWeak'),
    2: this.t('baseball.shortSoft'),
    3: this.t('baseball.shortMed'),
    4: this.t('baseball.shortHard'),
    5: this.t('baseball.shortCrushed'),
    6: this.t('baseball.shortPlakata'),
  }));

  readonly handLabels: Signal<Record<Hand, string>> = computed(() => ({
    R: this.t('baseball.right'),
    L: this.t('baseball.left'),
    S: this.t('baseball.switch'),
  }));

  readonly pitcherHandLabels: Signal<Record<'R' | 'L', string>> = computed(() => ({
    R: this.t('baseball.rhp'),
    L: this.t('baseball.lhp'),
  }));

  readonly directionLabels = computed(() => ({
    pull: this.t('reports.pull'),
    center: this.t('reports.center'),
    oppo: this.t('reports.oppo'),
  }));

  async setLanguage(lang: AppLanguage): Promise<void> {
    await this.store.updateSettings({ language: lang });
  }
}

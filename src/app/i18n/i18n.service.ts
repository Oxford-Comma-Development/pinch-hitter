import { formatDate, registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { computed, inject, Injectable, Signal } from '@angular/core';
import { CoachStore, UnbackedWorkSummary } from '../data/coach-store';
import { AppLanguage, ContactType, Hand, HardHitRating, HitResult } from '../data/models';
import { en } from './dictionaries/en';
import { es } from './dictionaries/es';
import { TranslationDictionary } from './i18n.types';

const DICTIONARIES: Record<AppLanguage, TranslationDictionary> = {
  en,
  es,
};

// English locale data ships with Angular; Spanish dates need theirs registered once.
registerLocaleData(localeEs);

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly store = inject(CoachStore);

  readonly currentLang: Signal<AppLanguage> = computed(() => {
    return this.store.settings().language ?? 'en';
  });

  readonly isSpanish: Signal<boolean> = computed(() => this.currentLang() === 'es');

  /**
   * Looks up a key in the coach's language, falling back to English, then the key itself.
   * When a numeric `count` param is passed and the dictionary has `key.one` / `key.other`
   * forms, the plural form for that language is chosen (`1 practice`, `2 practices`).
   */
  t(key: string, params?: Record<string, string | number>): string {
    const lang = this.currentLang();
    let text = this.lookup(lang, key, params?.['count']);

    if (params) {
      for (const [paramKey, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), () => String(value));
      }
    }

    return text;
  }

  private lookup(lang: AppLanguage, key: string, count: string | number | undefined): string {
    const plural =
      typeof count === 'number'
        ? [`${key}.${new Intl.PluralRules(lang).select(count)}`, `${key}.other`]
        : [];
    for (const dictionary of [DICTIONARIES[lang], DICTIONARIES.en]) {
      for (const candidate of [...plural, key]) {
        if (dictionary?.[candidate] !== undefined) return dictionary[candidate];
      }
    }
    return key;
  }

  /**
   * Formats a date in the coach's language. `format` is either a dictionary key holding a
   * per-language pattern (`date.monthDayYear`) or an Angular format name (`mediumDate`).
   */
  date(value: string | number | Date | null | undefined, format = 'mediumDate'): string {
    if (value === null || value === undefined || value === '') return '';
    return formatDate(value, this.t(format), this.currentLang());
  }

  /** Untitled practices are stored with the English default title; show it in the coach's language. */
  sessionTitle(title: string | undefined): string {
    return !title || title === 'Batting practice' ? this.t('home.defaultSessionTitle') : title;
  }

  /** "2 new practices and 14 new contacts recorded since your last backup" in either language. */
  unbackedSummary(work: UnbackedWorkSummary): string {
    const sessions = work.neverBackedUp ? 'backup.practices' : 'backup.newPractices';
    const contacts = work.neverBackedUp ? 'backup.contacts' : 'backup.newContacts';
    const parts: string[] = [];
    if (work.unbackedSessions) parts.push(this.t(sessions, { count: work.unbackedSessions }));
    if (work.unbackedEvents) parts.push(this.t(contacts, { count: work.unbackedEvents }));
    if (!parts.length && work.unbackedPlayers) {
      parts.push(this.t('backup.rosterChanges', { count: work.unbackedPlayers }));
    }
    const list = parts.join(this.t('backup.and'));
    return this.t(work.neverBackedUp ? 'backup.notYetBackedUp' : 'backup.sinceLastBackup', {
      list,
    });
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

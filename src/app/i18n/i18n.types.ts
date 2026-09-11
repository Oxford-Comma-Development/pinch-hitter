import { AppLanguage, ContactType, HitResult, HardHitRating, Hand } from '../data/models';

export type { AppLanguage };

export interface BaseballLabels {
  contactTypes: Record<ContactType, string>;
  hitResults: Record<HitResult, string>;
  hardHit: Record<HardHitRating, string>;
  hardHitShort: Record<HardHitRating, string>;
  hands: Record<Hand, string>;
  directions: {
    pull: string;
    center: string;
    oppo: string;
  };
}

export type TranslationDictionary = Record<string, string>;

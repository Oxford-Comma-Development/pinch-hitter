import { inject, Pipe, PipeTransform } from '@angular/core';
import { I18nService } from './i18n.service';

/**
 * Like Angular's `date` pipe, but in the coach's language. Pass a `date.*` dictionary key so
 * each language can order day and month its own way, or any Angular format name.
 */
@Pipe({
  name: 'localDate',
  pure: false,
})
export class LocalDatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: string | number | Date | null | undefined, format?: string): string {
    return this.i18n.date(value, format);
  }
}

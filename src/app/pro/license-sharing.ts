import { APP_URL } from '../data/license-config';

/** Link that activates Pro on any device. The code rides in the fragment, never sent to a server. */
export function activationLink(code: string): string {
  return `${APP_URL}activate#code=${code}`;
}

/** A `mailto:` draft addressed to nobody: the coach picks their own address. No server involved. */
export function emailToSelfHref(code: string, subject: string, intro: string): string {
  const body = `${intro}\n\n${activationLink(code)}\n\n${code}\n`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function canShareText(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** Returns false if sharing failed or was cancelled. */
export async function shareActivationLink(code: string, title: string): Promise<boolean> {
  try {
    await navigator.share({ title, url: activationLink(code) });
    return true;
  } catch {
    return false;
  }
}

/**
 * iOS keeps Safari and Home Screen apps in separate storage. A purchase finished in a Safari tab
 * must be carried into the installed app by hand.
 */
export function isIosBrowserTab(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios =
    /iPhone|iPad|iPod/.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const standalone = nav.standalone === true || matchMedia('(display-mode: standalone)').matches;
  return ios && !standalone;
}

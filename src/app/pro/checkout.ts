import { LICENSE_FUNCTION_URL } from '../data/license-config';

export type CheckoutFailure = 'offline' | 'not_open' | 'unavailable';
export type ActivationFailure = 'offline' | 'not_open' | 'not_paid' | 'not_found' | 'unavailable';

export type CheckoutResult = { ok: true; url: string } | { ok: false; reason: CheckoutFailure };
export type CodeRequestResult =
  { ok: true; code: string } | { ok: false; reason: ActivationFailure };

/**
 * Asks the license function for a Stripe-hosted Checkout Session. `appUrl` (the page's base URL)
 * tells the function where to send the coach back to; it only honours allowed origins.
 */
export async function createCheckoutSession(
  appUrl: string,
  functionUrl = LICENSE_FUNCTION_URL,
): Promise<CheckoutResult> {
  if (!functionUrl) return { ok: false, reason: 'not_open' };
  if (!navigator.onLine) return { ok: false, reason: 'offline' };
  try {
    const response = await fetch(`${functionUrl}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appUrl }),
    });
    const body = (await response.json()) as { url?: unknown };
    if (response.ok && typeof body.url === 'string' && body.url.startsWith('https://')) {
      return { ok: true, url: body.url };
    }
    return { ok: false, reason: 'unavailable' };
  } catch {
    return { ok: false, reason: navigator.onLine ? 'unavailable' : 'offline' };
  }
}

/** Exchanges the Checkout Session id from Stripe's success redirect for a signed unlock code. */
export async function requestUnlockCode(
  sessionId: string,
  functionUrl = LICENSE_FUNCTION_URL,
): Promise<CodeRequestResult> {
  if (!functionUrl) return { ok: false, reason: 'not_open' };
  if (!navigator.onLine) return { ok: false, reason: 'offline' };
  try {
    const response = await fetch(`${functionUrl}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    if (response.status === 402) return { ok: false, reason: 'not_paid' };
    if (response.status === 400 || response.status === 404)
      return { ok: false, reason: 'not_found' };
    const body = (await response.json()) as { code?: unknown };
    if (response.ok && typeof body.code === 'string') return { ok: true, code: body.code };
    return { ok: false, reason: 'unavailable' };
  } catch {
    return { ok: false, reason: navigator.onLine ? 'unavailable' : 'offline' };
  }
}

import { MAX_SHARE_BYTES, type ShareBundle } from '../../shared/share-contract';
import { validateShareBundle } from './bundle';

export interface CreatedShare {
  id: string;
  createdAt: number;
  expiresAt: number;
  deleteToken: string;
}
export interface SharedContent {
  bundle: ShareBundle;
  expiresAt: number;
}
export class ShareError extends Error {
  constructor(
    public code: string,
    public status = 0,
    public retryAfter = 0,
    public resetAt = 0,
    public retryAt = 0,
  ) {
    super(code);
    this.name = 'ShareError';
  }
}

const loopback = (hostname: string) =>
  ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

export function getSharingConfig() {
  let apiUrl = '';
  try {
    const url = new URL(import.meta.env.VITE_SHARE_API_URL || '');
    if (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.protocol === 'https:' ||
        (import.meta.env.DEV &&
          url.protocol === 'http:' &&
          loopback(url.hostname)))
    )
      apiUrl = url.href.replace(/\/$/, '');
  } catch {
    /* Sharing stays unavailable until deployment is configured. */
  }
  const siteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
  const devBypass = Boolean(
    apiUrl &&
    import.meta.env.DEV &&
    import.meta.env.VITE_SHARE_DEV_BYPASS === 'true' &&
    loopback(new URL(apiUrl).hostname) &&
    loopback(location.hostname),
  );
  return {
    apiUrl,
    siteKey,
    devBypass,
    canCreate: Boolean(apiUrl && (siteKey || devBypass)),
  };
}

export function shareLink(id: string) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = `share/${encodeURIComponent(id)}`;
  return url.href;
}

function apiUrl() {
  const { apiUrl } = getSharingConfig();
  if (!apiUrl) throw new ShareError('unconfigured');
  return apiUrl;
}

function endpoint(id?: string, base = apiUrl()) {
  if (id !== undefined && !/^[A-Za-z0-9_-]{16,128}$/.test(id))
    throw new ShareError('not_found', 404);
  return `${base}/shares${id ? `/${encodeURIComponent(id)}` : ''}`;
}

export interface MonthlyShareBlock {
  /** The service's calendar-month boundary, used for display. */
  resetAt: number;
  /** Local-clock deadline derived from the service's retry delay. */
  retryAt: number;
  receivedAt: number;
}
export const SHARE_MONTHLY_BLOCK_EVENT = 'learnmd-sharing-monthly-block';
const MAX_MONTH_WAIT_MS = 32 * 24 * 60 * 60 * 1000;
const monthlyBlocks = new Map<string, MonthlyShareBlock>();
const monthlyKey = (base: string) => `learnmd-share-monthly:${base}`;

function validResetDate(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
    return false;
  const date = new Date(value);
  return (
    Number.isFinite(date.getTime()) &&
    date.getUTCDate() === 1 &&
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

function validMonthlyBlock(value: unknown): value is MonthlyShareBlock {
  if (!value || typeof value !== 'object') return false;
  const block = value as MonthlyShareBlock;
  return (
    validResetDate(block.resetAt) &&
    Number.isSafeInteger(block.receivedAt) &&
    Number.isSafeInteger(block.retryAt) &&
    block.receivedAt > 0 &&
    block.receivedAt <= Date.now() &&
    block.retryAt > block.receivedAt &&
    block.retryAt - block.receivedAt <= MAX_MONTH_WAIT_MS
  );
}

export function getMonthlyShareBlock(
  base = getSharingConfig().apiUrl,
): MonthlyShareBlock | null {
  if (!base) return null;
  let block = monthlyBlocks.get(base);
  try {
    const saved = localStorage.getItem(monthlyKey(base));
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (validMonthlyBlock(parsed)) block = parsed;
      else localStorage.removeItem(monthlyKey(base));
    }
  } catch {
    /* Keep the page-lifetime fallback when storage is restricted. */
  }
  if (!block) return null;
  if (!validMonthlyBlock(block) || block.retryAt <= Date.now()) {
    monthlyBlocks.delete(base);
    try {
      localStorage.removeItem(monthlyKey(base));
    } catch {
      /* Already expired in memory. */
    }
    return null;
  }
  monthlyBlocks.set(base, block);
  return block;
}

function monthlyError(block: MonthlyShareBlock) {
  return new ShareError(
    'monthly_limit',
    429,
    Math.max(1, Math.ceil((block.retryAt - Date.now()) / 1000)),
    block.resetAt,
    block.retryAt,
  );
}

function assertMonthlyAvailable(base: string) {
  const block = getMonthlyShareBlock(base);
  if (block) throw monthlyError(block);
}

function rememberMonthlyBlock(
  base: string,
  resetAt: number,
  retryAfter: number,
  serverTime: number,
) {
  if (!validResetDate(resetAt)) return null;
  const receivedAt = Date.now();
  const delay =
    retryAfter > 0
      ? retryAfter * 1000
      : resetAt - (Number.isFinite(serverTime) ? serverTime : receivedAt);
  if (!Number.isFinite(delay) || delay <= 0 || delay > MAX_MONTH_WAIT_MS)
    return null;
  const block = { resetAt, receivedAt, retryAt: receivedAt + Math.ceil(delay) };
  monthlyBlocks.set(base, block);
  try {
    localStorage.setItem(monthlyKey(base), JSON.stringify(block));
  } catch {
    /* The memory fallback still stops repeated requests. */
  }
  window.dispatchEvent(new Event(SHARE_MONTHLY_BLOCK_EVENT));
  return block;
}

export function monthlyShareMessage(
  resetAt: number,
  t: (en: string, pl: string) => string,
) {
  const date = new Intl.DateTimeFormat(t('en-GB', 'pl-PL'), {
    dateStyle: 'long',
    timeStyle: 'long',
  }).format(resetAt);
  return t(
    `Sharing paused until ${date}. Your local notes are still available.`,
    `Udostępnianie wstrzymane do ${date}. Twoje lokalne notatki są nadal dostępne.`,
  );
}

async function boundedText(
  response: Response,
  maximum: number,
  tooLarge: ShareError,
) {
  if (Number(response.headers.get('Content-Length')) > maximum) {
    await response.body?.cancel();
    throw tooLarge;
  }
  const reader = response.body?.getReader();
  if (!reader) {
    const source = await response.text();
    if (new TextEncoder().encode(source).byteLength > maximum) throw tooLarge;
    return source;
  }
  const decoder = new TextDecoder();
  let size = 0;
  let source = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw tooLarge;
      }
      source += decoder.decode(value, { stream: true });
    }
    return source + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function request(url: string, init: RequestInit, monthlyBase?: string) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ShareError('network');
  }
  if (!response.ok) {
    let body: { error?: string; retryAfter?: number; resetAt?: number } = {};
    try {
      const value: unknown = JSON.parse(
        await boundedText(response, 4096, new ShareError('invalid_response')),
      );
      if (value && typeof value === 'object') {
        const fields = value as Record<string, unknown>;
        if (typeof fields.error === 'string') body.error = fields.error;
        if (typeof fields.retryAfter === 'number')
          body.retryAfter = fields.retryAfter;
        if (typeof fields.resetAt === 'number') body.resetAt = fields.resetAt;
      }
    } catch {
      /* The status remains useful. */
    }
    const retryHeader = response.headers.get('Retry-After');
    const serverTime = Date.parse(response.headers.get('Date') || '');
    const delay =
      retryHeader && !/^\d+$/.test(retryHeader)
        ? (Date.parse(retryHeader) -
            (Number.isFinite(serverTime) ? serverTime : Date.now())) /
          1000
        : Number(retryHeader || body.retryAfter || 0);
    const retryAfter = Number.isFinite(delay)
      ? Math.max(0, Math.ceil(delay))
      : 0;
    if (
      monthlyBase &&
      response.status === 429 &&
      body.error === 'monthly_limit'
    ) {
      const block = rememberMonthlyBlock(
        monthlyBase,
        body.resetAt || 0,
        retryAfter,
        serverTime,
      );
      if (block) throw monthlyError(block);
    }
    throw new ShareError(
      body.error || 'request_failed',
      response.status,
      retryAfter,
    );
  }
  return response;
}

async function withTimeout<T>(
  signal: AbortSignal | undefined,
  action: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 60000);
  try {
    return await action(controller.signal);
  } catch (error) {
    if (timedOut) throw new ShareError('timeout');
    throw error;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

const clientTokenPattern = /^v1\.[A-Za-z0-9_-]{32}\.[A-Za-z0-9_-]{43}$/;
const clientKey = (base: string) => `learnmd-share-client:${base}`;
const clientTokens = new Map<string, string>();
const clientSessions = new Map<string, Promise<string>>();

function forgetClient(base: string, token: string) {
  if (clientTokens.get(base) === token) clientTokens.delete(base);
  try {
    if (localStorage.getItem(clientKey(base)) === token)
      localStorage.removeItem(clientKey(base));
  } catch {
    /* The in-memory fallback is already cleared. */
  }
}

function awaitSession(
  session: Promise<string>,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      signal.removeEventListener('abort', cancel);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', cancel, { once: true });
    session.then(
      (token) => {
        signal.removeEventListener('abort', cancel);
        resolve(token);
      },
      (error) => {
        signal.removeEventListener('abort', cancel);
        reject(error);
      },
    );
    if (signal.aborted) cancel();
  });
}

async function getClientToken(
  base: string,
  signal: AbortSignal,
): Promise<string> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  assertMonthlyAvailable(base);
  const memoryToken = clientTokens.get(base);
  if (memoryToken) return memoryToken;
  try {
    const saved = localStorage.getItem(clientKey(base));
    if (saved && clientTokenPattern.test(saved)) {
      clientTokens.set(base, saved);
      return saved;
    }
    if (saved) localStorage.removeItem(clientKey(base));
  } catch {
    /* Restricted storage uses a token for this page's lifetime. */
  }
  let session = clientSessions.get(base);
  if (!session) {
    // A caller closing its preview must not cancel other callers' initialization.
    session = withTimeout(undefined, async (signal) => {
      const response = await request(
        `${base}/session`,
        {
          method: 'POST',
          signal,
        },
        base,
      );
      if (response.status !== 201) throw new ShareError('invalid_session');
      let token: unknown;
      try {
        const value: unknown = JSON.parse(
          await boundedText(response, 2048, new ShareError('invalid_session')),
        );
        if (value && typeof value === 'object')
          token = (value as Record<string, unknown>).token;
      } catch (error) {
        if (signal.aborted) throw error;
        throw new ShareError('invalid_session');
      }
      if (typeof token !== 'string' || !clientTokenPattern.test(token))
        throw new ShareError('invalid_session');
      clientTokens.set(base, token);
      try {
        localStorage.setItem(clientKey(base), token);
      } catch {
        /* Keep the memory fallback. */
      }
      return token;
    }).finally(() => {
      clientSessions.delete(base);
    });
    clientSessions.set(base, session);
  }
  return awaitSession(session, signal);
}

async function clientRequest(
  base: string,
  url: string,
  init: RequestInit & { signal: AbortSignal },
) {
  assertMonthlyAvailable(base);
  const token = await getClientToken(base, init.signal);
  assertMonthlyAvailable(base);
  const headers = { ...init.headers, 'X-Share-Client': token };
  try {
    return await request(url, { ...init, headers }, base);
  } catch (error) {
    if (
      error instanceof ShareError &&
      error.status === 401 &&
      error.code === 'invalid_client'
    )
      forgetClient(base, token);
    throw error;
  }
}

export async function createShare(
  bundle: ShareBundle,
  token: string,
  signal?: AbortSignal,
): Promise<CreatedShare> {
  return withTimeout(signal, async (signal) => {
    const base = apiUrl();
    const body = JSON.stringify(bundle);
    if (new TextEncoder().encode(body).byteLength > MAX_SHARE_BYTES)
      throw new ShareError('too_large', 413);
    const response = await clientRequest(base, endpoint(undefined, base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Turnstile-Token': token,
      },
      body,
      signal,
    });
    const value = (await response.json()) as CreatedShare;
    if (
      !/^[A-Za-z0-9_-]{16,128}$/.test(value.id) ||
      typeof value.deleteToken !== 'string' ||
      !value.deleteToken ||
      !Number.isFinite(value.createdAt) ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= Date.now()
    )
      throw new ShareError('invalid_response');
    return value;
  });
}

export async function fetchShare(
  id: string,
  signal?: AbortSignal,
): Promise<SharedContent> {
  return withTimeout(signal, async (signal) => {
    const base = apiUrl();
    const response = await clientRequest(base, endpoint(id, base), { signal });
    const expiresAt = Number(response.headers.get('X-Share-Expires-At'));
    if (!Number.isFinite(expiresAt) || expiresAt <= 0)
      throw new ShareError('invalid_response');
    if (expiresAt <= Date.now()) throw new ShareError('expired', 410);
    const source = await boundedText(
      response,
      MAX_SHARE_BYTES,
      new ShareError('too_large', 413),
    );
    try {
      return { bundle: validateShareBundle(JSON.parse(source)), expiresAt };
    } catch (error) {
      if (error instanceof ShareError) throw error;
      throw new ShareError('invalid_bundle');
    }
  });
}

export async function deleteShare(
  id: string,
  token: string,
  signal?: AbortSignal,
) {
  await withTimeout(signal, (signal) =>
    request(endpoint(id), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal,
    }),
  );
  forgetOwnedShare(id);
}

const ownerKey = (id: string) => `learnmd-owned-share:${id}`;
export function rememberOwnedShare(share: CreatedShare): boolean {
  try {
    localStorage.setItem(ownerKey(share.id), JSON.stringify(share));
    return true;
  } catch {
    return false;
  }
}
export function getOwnedShare(id: string): CreatedShare | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(ownerKey(id)) || 'null',
    ) as CreatedShare | null;
    if (
      value?.id === id &&
      typeof value.deleteToken === 'string' &&
      value.expiresAt > Date.now()
    )
      return value;
  } catch {
    /* Ownership is optional; viewing still works. */
  }
  return null;
}
export function forgetOwnedShare(id: string) {
  try {
    localStorage.removeItem(ownerKey(id));
  } catch {
    /* Already removed remotely. */
  }
}

export function shareErrorText(
  error: unknown,
  t: (en: string, pl: string) => string,
) {
  if (!(error instanceof ShareError))
    return t(
      'This operation could not be completed. Your local notes are unchanged.',
      'Nie udało się zakończyć operacji. Twoje lokalne notatki pozostały bez zmian.',
    );
  if (error.code === 'unconfigured')
    return t(
      'Link sharing is not available in this installation yet.',
      'Udostępnianie linkiem nie jest jeszcze dostępne w tej wersji aplikacji.',
    );
  if (error.code === 'monthly_limit')
    return validResetDate(error.resetAt)
      ? monthlyShareMessage(error.resetAt, t)
      : t(
          'Sharing has reached its monthly limit. Your local notes are still available.',
          'Udostępnianie osiągnęło miesięczny limit. Twoje lokalne notatki są nadal dostępne.',
        );
  if (error.code === 'invalid_client' || error.code === 'invalid_session')
    return t(
      'Sharing could not verify this browser. Please try again.',
      'Nie udało się zweryfikować tej przeglądarki. Spróbuj ponownie.',
    );
  if (error.status === 410)
    return t(
      'This link has expired. Ask the author for a new link.',
      'Ten link wygasł. Poproś autora o nowy link.',
    );
  if (error.status === 404)
    return t(
      'This link is unavailable. It may have expired or been disabled.',
      'Ten link jest niedostępny. Mógł wygasnąć lub zostać wyłączony.',
    );
  if (error.code === 'daily_limit')
    return t(
      'The daily sharing limit has been reached. Please wait for it to reset.',
      'Osiągnięto dzienny limit udostępniania. Poczekaj na jego odnowienie.',
    );
  if (error.code === 'storage_full')
    return t(
      'The sharing storage is full. Please try again after older links expire.',
      'Miejsce na udostępnione kopie jest zapełnione. Spróbuj ponownie po wygaśnięciu starszych linków.',
    );
  if (error.code === 'upload_busy')
    return t(
      'Another upload is finishing. Please wait a moment before trying again.',
      'Trwa kończenie innego przesyłania. Odczekaj chwilę przed kolejną próbą.',
    );
  if (error.status === 429)
    return t(
      'Too many requests. Please wait before trying again.',
      'Zbyt wiele żądań. Poczekaj przed kolejną próbą.',
    );
  if (error.status === 413)
    return t(
      'The shared copy exceeds the 20 MB limit. Share a smaller folder or note.',
      'Udostępniana kopia przekracza limit 20 MB. Wybierz mniejszy folder lub notatkę.',
    );
  if (error.status === 403)
    return t(
      'Verification failed. Complete the verification again and retry.',
      'Weryfikacja nie powiodła się. Przejdź ją ponownie i spróbuj jeszcze raz.',
    );
  if (error.code === 'network')
    return t(
      'Could not reach the sharing service. Check your connection and try again.',
      'Nie można połączyć się z usługą udostępniania. Sprawdź połączenie i spróbuj ponownie.',
    );
  if (error.code === 'timeout')
    return t(
      'The sharing service took too long to respond. Please try again.',
      'Usługa udostępniania odpowiada zbyt długo. Spróbuj ponownie.',
    );
  if (error.code === 'invalid_bundle' || error.code === 'invalid_response')
    return t(
      'This shared copy is invalid or unsupported. Nothing has been imported.',
      'Udostępniona kopia jest nieprawidłowa lub nieobsługiwana. Niczego nie zaimportowano.',
    );
  if (error.status === 503)
    return t(
      'Sharing is temporarily unavailable. Please try again later.',
      'Udostępnianie jest chwilowo niedostępne. Spróbuj ponownie później.',
    );
  return t(
    'The sharing request failed. Please try again.',
    'Udostępnianie nie powiodło się. Spróbuj ponownie.',
  );
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_SHARE_BYTES,
  SHARE_TTL_MS,
  type ShareBundle,
} from '../../shared/share-contract';
let client: typeof import('./client');

const id = 'abcdefghijklmnopqrstuvwxyz123456';
const clientToken = `v1.${'a'.repeat(32)}.${'b'.repeat(43)}`;
const sessionKey = 'learnmd-share-client:https://share.example';
const bundle: ShareBundle = {
  format: 'learnmd-share',
  version: 1,
  kind: 'note',
  title: 'Shared chapter',
  notes: [
    {
      id: 'n1',
      title: 'Shared chapter',
      source:
        '---\ntitle: Shared chapter\nversion: "1.0"\n---\n\nA useful explanation.',
      folderId: null,
    },
  ],
  folders: [],
  assets: [],
};
const fetchMock = vi.fn<typeof fetch>();
beforeEach(async () => {
  vi.resetModules();
  client = await import('./client');
  vi.stubEnv('VITE_SHARE_API_URL', 'https://share.example');
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'public-site-key');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  localStorage.clear();
  localStorage.setItem(sessionKey, clientToken);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const sharedResponse = () =>
  Response.json(bundle, {
    headers: { 'X-Share-Expires-At': String(Date.now() + SHARE_TTL_MS) },
  });
const sessionResponse = (token = clientToken) =>
  Response.json({ token }, { status: 201 });

describe('monthly sharing pause', () => {
  const resetAt = Date.UTC(2026, 10, 1);
  const receivedAt = resetAt - 3600000;
  const pauseResponse = (retryAfter = 3600, date = resetAt) =>
    Response.json(
      { error: 'monthly_limit', retryAfter, resetAt: date },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          Date: new Date(receivedAt).toUTCString(),
        },
      },
    );
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(receivedAt);
  });

  it('persists the reset date and blocks creation, downloads and session renewal after reload', async () => {
    fetchMock.mockResolvedValueOnce(pauseResponse());
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'monthly_limit',
      resetAt,
      retryAt: resetAt,
    });
    expect(client.getMonthlyShareBlock()).toEqual({
      resetAt,
      retryAt: resetAt,
      receivedAt,
    });
    localStorage.removeItem(sessionKey);
    vi.resetModules();
    const reloaded = await import('./client');
    await expect(reloaded.createShare(bundle, 'proof')).rejects.toMatchObject({
      code: 'monthly_limit',
    });
    await expect(reloaded.fetchShare(id)).rejects.toMatchObject({
      code: 'monthly_limit',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const message = reloaded.shareErrorText(
      new reloaded.ShareError('monthly_limit', 429, 3600, resetAt),
      (en) => en,
    );
    expect(message).toContain('Sharing paused until');
    expect(message).toContain('Your local notes are still available');
    expect(message).not.toContain('3600 seconds');
  });

  it('expires the local gate automatically but sends nothing until the next manual request', async () => {
    fetchMock.mockResolvedValueOnce(pauseResponse());
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'monthly_limit',
    });
    await vi.advanceTimersByTimeAsync(3600000);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(client.getMonthlyShareBlock()).toBeNull();
    expect(
      localStorage.getItem('learnmd-share-monthly:https://share.example'),
    ).toBeNull();
    fetchMock.mockResolvedValueOnce(sharedResponse());
    expect((await client.fetchShare(id)).bundle).toEqual(bundle);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('allows revocation while paused and keeps an ordinary deletion cooldown separate', async () => {
    fetchMock.mockResolvedValueOnce(pauseResponse());
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'monthly_limit',
    });
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': '8' } },
      ),
    );
    await expect(client.deleteShare(id, 'owner-secret')).rejects.toMatchObject({
      code: 'rate_limited',
      retryAfter: 8,
    });
    expect(client.getMonthlyShareBlock()?.resetAt).toBe(resetAt);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.deleteShare(id, 'owner-secret');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'monthly_limit',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('scopes pauses to the API and retains a memory fallback when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    fetchMock.mockResolvedValueOnce(pauseResponse());
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'monthly_limit',
    });
    await expect(client.createShare(bundle, 'proof')).rejects.toMatchObject({
      code: 'monthly_limit',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.stubEnv('VITE_SHARE_API_URL', 'https://other.example');
    fetchMock
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(sharedResponse());
    expect((await client.fetchShare(id)).bundle).toEqual(bundle);
    expect(client.getMonthlyShareBlock()).toBeNull();
    vi.stubEnv('VITE_SHARE_API_URL', 'https://share.example');
    expect(client.getMonthlyShareBlock()?.resetAt).toBe(resetAt);
  });

  it('caches a session-endpoint monthly response without repeatedly trying initialization', async () => {
    localStorage.removeItem(sessionKey);
    fetchMock.mockResolvedValueOnce(pauseResponse());
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'monthly_limit',
    });
    expect(fetchMock.mock.calls[0][0]).toBe('https://share.example/session');
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'monthly_limit',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('uses the server delay when the device clock differs, and rejects malformed reset dates', async () => {
    vi.setSystemTime(receivedAt + 5 * 3600000);
    fetchMock.mockResolvedValueOnce(pauseResponse());
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'monthly_limit',
      resetAt,
      retryAt: receivedAt + 6 * 3600000,
    });
    // A backwards clock correction invalidates the local timer; the server remains authoritative.
    vi.setSystemTime(receivedAt);
    expect(client.getMonthlyShareBlock()).toBeNull();
    fetchMock.mockResolvedValueOnce(pauseResponse(3600, resetAt + 86400000));
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'monthly_limit',
      resetAt: 0,
    });
    expect(client.getMonthlyShareBlock()).toBeNull();
  });
});

describe('anonymous browser identity', () => {
  it('initializes once, persists the server-issued token and reuses it after a page reload', async () => {
    localStorage.removeItem(sessionKey);
    fetchMock
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(sharedResponse());
    await client.fetchShare(id);
    expect(fetchMock.mock.calls[0]).toEqual([
      'https://share.example/session',
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        redirect: 'error',
      }),
    ]);
    expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined();
    expect(fetchMock.mock.calls[0][1]?.headers).toBeUndefined();
    expect(localStorage.getItem(sessionKey)).toBe(clientToken);
    fetchMock.mockClear().mockResolvedValueOnce(sharedResponse());
    vi.resetModules();
    const reloaded = await import('./client');
    await reloaded.fetchShare(id);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      `https://share.example/shares/${id}`,
      expect.objectContaining({ headers: { 'X-Share-Client': clientToken } }),
    );
  });

  it('shares a single initialization between concurrent first requests', async () => {
    localStorage.removeItem(sessionKey);
    let finishSession!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSession = resolve;
        }),
    );
    const first = client.fetchShare(id);
    const second = client.fetchShare(id);
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock
      .mockResolvedValueOnce(sharedResponse())
      .mockResolvedValueOnce(sharedResponse());
    finishSession(sessionResponse());
    expect(
      (await Promise.all([first, second])).every(
        (result) => result.bundle.title === bundle.title,
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/session')),
    ).toHaveLength(1);
  });

  it('does not expose one API identity to another API or redirects', async () => {
    fetchMock.mockResolvedValueOnce(sharedResponse());
    await client.fetchShare(id);
    const otherToken = `v1.${'c'.repeat(32)}.${'d'.repeat(43)}`;
    vi.stubEnv('VITE_SHARE_API_URL', 'https://other.example/api');
    fetchMock
      .mockResolvedValueOnce(sessionResponse(otherToken))
      .mockResolvedValueOnce(sharedResponse());
    await client.fetchShare(id);
    expect(fetchMock.mock.calls[1]).toEqual([
      'https://other.example/api/session',
      expect.objectContaining({ method: 'POST', redirect: 'error' }),
    ]);
    expect(fetchMock.mock.calls[1][1]?.headers).toBeUndefined();
    expect(fetchMock.mock.calls[2]).toEqual([
      `https://other.example/api/shares/${id}`,
      expect.objectContaining({
        headers: { 'X-Share-Client': otherToken },
        redirect: 'error',
      }),
    ]);
    expect(
      localStorage.getItem('learnmd-share-client:https://other.example/api'),
    ).toBe(otherToken);
    expect(localStorage.getItem(sessionKey)).toBe(clientToken);
  });

  it('clears a rejected token without repeating an upload and renews it on manual retry', async () => {
    const invalid = () =>
      Response.json({ error: 'invalid_client' }, { status: 401 });
    fetchMock.mockResolvedValueOnce(invalid());
    await expect(
      client.createShare(bundle, 'first-proof'),
    ).rejects.toMatchObject({ status: 401, code: 'invalid_client' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(localStorage.getItem(sessionKey)).toBeNull();
    const replacement = `v1.${'e'.repeat(32)}.${'f'.repeat(43)}`;
    const created = {
      id,
      createdAt: Date.now(),
      expiresAt: Date.now() + SHARE_TTL_MS,
      deleteToken: 'secret',
    };
    fetchMock
      .mockResolvedValueOnce(sessionResponse(replacement))
      .mockResolvedValueOnce(Response.json(created));
    expect(await client.createShare(bundle, 'new-proof')).toEqual(created);
    expect(fetchMock.mock.calls[2][1]?.headers).toEqual({
      'Content-Type': 'application/json',
      'X-Turnstile-Token': 'new-proof',
      'X-Share-Client': replacement,
    });
  });

  it('preserves initialization rate-limit cooldown and retries initialization after failure', async () => {
    localStorage.removeItem(sessionKey);
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': '23' } },
      ),
    );
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      status: 429,
      retryAfter: 23,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(sharedResponse());
    expect((await client.fetchShare(id)).bundle).toEqual(bundle);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/session')),
    ).toHaveLength(2);
  });

  it('aborts one subscriber without poisoning another subscriber or the shared initialization', async () => {
    localStorage.removeItem(sessionKey);
    let finishSession!: (response: Response) => void;
    let sessionSignal: AbortSignal | null | undefined;
    fetchMock.mockImplementationOnce((_url, init) => {
      sessionSignal = init?.signal;
      return new Promise((resolve) => {
        finishSession = resolve;
      });
    });
    const controller = new AbortController();
    const first = client.fetchShare(id, controller.signal);
    const assertion = expect(first).rejects.toMatchObject({
      name: 'AbortError',
    });
    const second = client.fetchShare(id);
    controller.abort();
    await assertion;
    expect(sessionSignal?.aborted).toBe(false);
    fetchMock.mockResolvedValueOnce(sharedResponse());
    finishSession(sessionResponse());
    expect((await second).bundle).toEqual(bundle);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps one page-lifetime identity when browser storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    fetchMock
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(sharedResponse())
      .mockResolvedValueOnce(sharedResponse());
    await client.fetchShare(id);
    await client.fetchShare(id);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/session')),
    ).toHaveLength(1);
    expect(fetchMock.mock.calls[2][1]?.headers).toEqual({
      'X-Share-Client': clientToken,
    });
  });

  it('rejects malformed and oversized session replies before sending a share request', async () => {
    localStorage.removeItem(sessionKey);
    fetchMock.mockResolvedValueOnce(sessionResponse('untrusted-value'));
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'invalid_session',
    });
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(2049));
      },
      cancel,
    });
    fetchMock.mockResolvedValueOnce(new Response(stream, { status: 201 }));
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'invalid_session',
    });
    expect(cancel).toHaveBeenCalledOnce();
    expect(
      fetchMock.mock.calls.every(([url]) => String(url).endsWith('/session')),
    ).toBe(true);
    expect(localStorage.getItem(sessionKey)).toBeNull();
  });

  it('revokes an owned share without initializing an anonymous browser session', async () => {
    localStorage.removeItem(sessionKey);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.deleteShare(id, 'delete-secret');
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      `https://share.example/shares/${id}`,
      expect.objectContaining({
        method: 'DELETE',
        headers: { Authorization: 'Bearer delete-secret' },
      }),
    );
  });

  it('does not discard a renewed identity when an older request returns a late 401', async () => {
    const invalid = () =>
      Response.json({ error: 'invalid_client' }, { status: 401 });
    let finishOldRequest!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOldRequest = resolve;
        }),
    );
    const oldRequest = client.fetchShare(id);
    const oldAssertion = expect(oldRequest).rejects.toMatchObject({
      code: 'invalid_client',
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    fetchMock.mockResolvedValueOnce(invalid());
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'invalid_client',
    });
    const replacement = `v1.${'g'.repeat(32)}.${'h'.repeat(43)}`;
    fetchMock
      .mockResolvedValueOnce(sessionResponse(replacement))
      .mockResolvedValueOnce(sharedResponse());
    await client.fetchShare(id);
    finishOldRequest(invalid());
    await oldAssertion;
    expect(localStorage.getItem(sessionKey)).toBe(replacement);
    fetchMock.mockResolvedValueOnce(sharedResponse());
    await client.fetchShare(id);
    expect(fetchMock.mock.calls.at(-1)?.[1]?.headers).toEqual({
      'X-Share-Client': replacement,
    });
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/session')),
    ).toHaveLength(1);
  });
});
describe('sharing client', () => {
  it('stays offline when unconfigured and rejects non-HTTPS production endpoints', async () => {
    vi.stubEnv('VITE_SHARE_API_URL', '');
    expect(client.getSharingConfig().canCreate).toBe(false);
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'unconfigured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_SHARE_API_URL', 'http://127.0.0.1:8787');
    vi.stubEnv('VITE_SHARE_DEV_BYPASS', 'true');
    expect(client.getSharingConfig()).toMatchObject({
      apiUrl: '',
      devBypass: false,
      canCreate: false,
    });
  });
  it('uploads an explicit copy with verification, and keeps deletion credentials out of the URL', async () => {
    const created = {
      id,
      createdAt: Date.now(),
      expiresAt: Date.now() + SHARE_TTL_MS,
      deleteToken: 'private-secret',
    };
    fetchMock.mockResolvedValueOnce(Response.json(created));
    expect(await client.createShare(bundle, 'challenge-token')).toEqual(
      created,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://share.example/shares',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(bundle),
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: {
          'Content-Type': 'application/json',
          'X-Turnstile-Token': 'challenge-token',
          'X-Share-Client': clientToken,
        },
      }),
    );
    expect(client.rememberOwnedShare(created)).toBe(true);
    expect(client.getOwnedShare(id)).toEqual(created);
    expect(client.shareLink(id)).toContain(`#share/${id}`);
    expect(client.shareLink(id)).not.toContain(created.deleteToken);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.deleteShare(id, created.deleteToken);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `https://share.example/shares/${id}`,
      expect.objectContaining({
        method: 'DELETE',
        headers: { Authorization: 'Bearer private-secret' },
      }),
    );
    expect(client.getOwnedShare(id)).toBeNull();
  });
  it('validates downloaded copies and refuses an expired server response', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(bundle, {
        headers: { 'X-Share-Expires-At': String(Date.now() + SHARE_TTL_MS) },
      }),
    );
    expect((await client.fetchShare(id)).bundle).toEqual(bundle);
    fetchMock.mockResolvedValueOnce(
      Response.json(bundle, {
        headers: { 'X-Share-Expires-At': String(Date.now() - 1) },
      }),
    );
    await expect(client.fetchShare(id)).rejects.toMatchObject({ status: 410 });
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { ...bundle, notes: [] },
        {
          headers: { 'X-Share-Expires-At': String(Date.now() + SHARE_TTL_MS) },
        },
      ),
    );
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'invalid_bundle',
    });
  });
  it('cancels oversized downloads even without a Content-Length header', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_SHARE_BYTES + 1));
      },
      cancel,
    });
    fetchMock.mockResolvedValueOnce(
      new Response(body, {
        headers: { 'X-Share-Expires-At': String(Date.now() + SHARE_TTL_MS) },
      }),
    );
    await expect(client.fetchShare(id)).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('uses Retry-After and distinguishes expired links from transport failures', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { error: 'daily_limit' },
        { status: 429, headers: { 'Retry-After': '91' } },
      ),
    );
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'daily_limit',
      status: 429,
      retryAfter: 91,
    });
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'network',
    });
  });
  it('aborts a stalled request after 60 seconds so the UI can retry', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const assertion = expect(client.fetchShare(id)).rejects.toMatchObject({
      code: 'timeout',
    });
    await vi.advanceTimersByTimeAsync(60000);
    await assertion;
  });
});
